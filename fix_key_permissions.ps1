$path = "azure-db-key.pem"
$acl = Get-Acl $path
# Disable inheritance and remove existing inherited permissions
$acl.SetAccessRuleProtection($true, $false)
# Build current user identity (Domain\Username)
$username = "$env:USERDOMAIN\$env:USERNAME"
# Grant Full Control to the current user
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule($username, "FullControl", "Allow")
$acl.SetAccessRule($rule)
# Apply ACL
Set-Acl $path $acl
Write-Output "Successfully secured permissions for $username on $path"
