# EC2 deployment

After a successful image build and ECR push on `main`, the `deploy` job
connects to EC2 and runs that build's image by digest. The published tag remains
`latest`. Deployments to the instance run one at a time.

Configure these GitHub repository variables:

| Variable | Value |
| --- | --- |
| `SSH_PRIVATE_KEY` | Full multiline SSH private key authorized on the instance |
| `EC2_HOST` | Optional host override; defaults to `18.215.233.13` |
| `EC2_USER` | Optional SSH user override; defaults to `ec2-user` |
| `EC2_PORT` | Application port on EC2; defaults to `80` |

The existing `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` secrets must allow
ECR authentication and image pulls as well as pushes. The runner sends a temporary
ECR token over SSH; EC2 does not need AWS CLI or stored AWS access keys.

Docker must be running on EC2, and the SSH user must be able to run
`sudo -n docker` without a password. SSH uses port 22. The instance security
group must allow SSH from the runner and application traffic on `EC2_PORT`.
The EC2 CPU architecture must match the built image (currently Linux x86_64).

The script trusts the SSH host key on its first connection within each job,
and checks the same key on subsequent connections in that job.

The named `juice-shop` container is stopped and replaced after the new image
is pulled. Expect a short service interruption. An HTTP startup check runs
inside the new container; a failed startup restores the previous container.
Container-local application data does not persist across successful replacements.

GitHub repository variables are not secret storage. The script masks the key
in its logs, but storing it as a GitHub Actions secret is preferable. If moved,
change `vars.SSH_PRIVATE_KEY` to `secrets.SSH_PRIVATE_KEY` in the workflow.
