# Import a base64-encoded .pfx into the current-user certificate store for Tauri MSI signing.
param(
  [Parameter(Mandatory = $true)]
  [string]$CertificateBase64,

  [Parameter(Mandatory = $true)]
  [string]$CertificatePassword
)

$ErrorActionPreference = 'Stop'

$certificateDir = Join-Path $PWD 'certificate'
New-Item -ItemType Directory -Force -Path $certificateDir | Out-Null

$tempCertPath = Join-Path $certificateDir 'tempCert.txt'
$pfxPath = Join-Path $certificateDir 'certificate.pfx'

Set-Content -Path $tempCertPath -Value $CertificateBase64 -NoNewline
certutil -decode $tempCertPath $pfxPath | Out-Null
Remove-Item -Path $tempCertPath -Force

$securePassword = ConvertTo-SecureString -String $CertificatePassword -Force -AsPlainText
Import-PfxCertificate -FilePath $pfxPath -CertStoreLocation 'Cert:\CurrentUser\My' -Password $securePassword | Out-Null

Write-Host '[import-windows-certificate] certificate imported into Cert:\CurrentUser\My'
