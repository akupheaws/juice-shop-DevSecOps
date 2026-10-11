#!/usr/bin/env bash
set -euo pipefail

for name in SSH_PRIVATE_KEY EC2_HOST EC2_USER EC2_PORT IMAGE_DIGEST AWS_REGION ECR_REGISTRY ECR_REPOSITORY; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required configuration: $name" >&2
    exit 1
  fi
done
[[ "$EC2_HOST" =~ ^[a-zA-Z0-9.-]+$ ]]
[[ "$EC2_USER" =~ ^[a-zA-Z0-9_-]+$ ]]
[[ "$EC2_PORT" =~ ^[0-9]+$ ]] && (( EC2_PORT >= 1 && EC2_PORT <= 65535 ))
[[ "$IMAGE_DIGEST" =~ ^sha256:[a-f0-9]{64}$ ]]

# Repository variables are not automatically masked by GitHub Actions.
while IFS= read -r line; do
  [[ -z "$line" ]] || printf '::add-mask::%s\n' "$line"
done <<< "$SSH_PRIVATE_KEY"

ssh_dir=$(mktemp -d)
trap 'rm -rf "$ssh_dir"' EXIT
printf '%s\n' "$SSH_PRIVATE_KEY" | tr -d '\r' > "$ssh_dir/key"
chmod 600 "$ssh_dir/key"
if ! ssh-keygen -y -P '' -f "$ssh_dir/key" >/dev/null 2>&1; then
  echo 'SSH_PRIVATE_KEY must contain a valid, unencrypted private key with actual newlines.' >&2
  exit 1
fi
ssh_options=(-i "$ssh_dir/key" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=20
  -o StrictHostKeyChecking=accept-new -o "UserKnownHostsFile=$ssh_dir/known_hosts")
target="$EC2_USER@$EC2_HOST"
image="$ECR_REGISTRY/$ECR_REPOSITORY@$IMAGE_DIGEST"

# Pass only the temporary ECR token to EC2, never the AWS access keys.
aws ecr get-login-password --region "$AWS_REGION" |
  ssh "${ssh_options[@]}" "$target" \
    "sudo -n docker login --username AWS --password-stdin '$ECR_REGISTRY'"

ssh "${ssh_options[@]}" "$target" "bash -s -- '$image' '$EC2_PORT' '$ECR_REGISTRY'" <<'REMOTE'
set -euo pipefail
image=$1
port=$2
registry=$3
trap 'sudo -n docker logout "$registry" >/dev/null 2>&1 || true' EXIT
sudo -n docker pull "$image"

# Keep the JWT signing key on EC2 so it survives image replacements.
sudo -n mkdir -p /var/lib/juice-shop/secrets
sudo -n chown 65532:65532 /var/lib/juice-shop/secrets
sudo -n chmod 700 /var/lib/juice-shop/secrets
sudo -n docker run --rm --user 65532:65532 \
  --mount type=bind,src=/var/lib/juice-shop/secrets,dst=/run/juice-shop-secrets \
  --entrypoint /nodejs/bin/node "$image" -e '
    const fs = require("node:fs");
    const crypto = require("node:crypto");
    const path = "/run/juice-shop-secrets/jwt-private.pem";
    if (!fs.existsSync(path)) {
      const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
      fs.writeFileSync(path, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o400, flag: "wx" });
    }
    const key = crypto.createPrivateKey(fs.readFileSync(path));
    if (key.asymmetricKeyType !== "rsa" || key.asymmetricKeyDetails.modulusLength < 2048) {
      throw new Error("JWT signing key must be RSA with at least 2048 bits");
    }
  '

# Keep the previous container available until the replacement responds.
sudo -n docker rm -f juice-shop-previous >/dev/null 2>&1 || true
if sudo -n docker container inspect juice-shop >/dev/null 2>&1; then
  sudo -n docker stop juice-shop
  sudo -n docker rename juice-shop juice-shop-previous
fi

rollback() {
  sudo -n docker rm -f juice-shop >/dev/null 2>&1 || true
  if sudo -n docker container inspect juice-shop-previous >/dev/null 2>&1; then
    sudo -n docker rename juice-shop-previous juice-shop
    sudo -n docker start juice-shop
  fi
}

if ! sudo -n docker run -d --name juice-shop --restart unless-stopped \
  -p "$port:3000" \
  --mount type=bind,src=/var/lib/juice-shop/secrets,dst=/run/juice-shop-secrets,readonly \
  -e JWT_PRIVATE_KEY_FILE=/run/juice-shop-secrets/jwt-private.pem "$image"; then
  rollback
  exit 1
fi
for attempt in {1..30}; do
  if sudo -n docker exec juice-shop /nodejs/bin/node -e \
    'fetch("http://127.0.0.1:3000").then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))'; then
    sudo -n docker rm juice-shop-previous >/dev/null 2>&1 || true
    echo 'Juice Shop deployment is healthy.'
    exit 0
  fi
  sleep 2
done
echo 'Juice Shop failed its startup check; restoring previous container.' >&2
sudo -n docker logs --tail 100 juice-shop >&2 || true
sudo -n docker inspect --format '{{json .State}}' juice-shop >&2 || true
rollback
exit 1
REMOTE
