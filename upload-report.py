import os
import sys

import requests

# Usage: python upload-report.py <report file> <DefectDojo scan type>
# e.g.   python upload-report.py gitleaks.json "Gitleaks Scan"
report_file, scan_type = sys.argv[1], sys.argv[2]

headers = {
    'Authorization': f'Token {os.environ["DEFECTDOJO_API_KEY"]}'
}

url = 'https://demo.defectdojo.org/api/v2/import-scan/'

data = {
    'active': 'true',
    'verified': 'true',
    'scan_type': scan_type,
    'minimum_severity': 'Low',
    'engagement': 37
}

with open(report_file, 'rb') as report:
    response = requests.post(url, headers=headers, data=data,
                             files={'file': report}, timeout=60)

if response.status_code == 201:
    print('Scan results imported successfully.')
else:
    print(f'Failed to import scan results. Status code: {response.status_code}')
    print(response.text)
    sys.exit(1)
