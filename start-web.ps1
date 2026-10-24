# Runs Flex Up in a web browser on this computer (port 8082, alongside the phone server on 8081).
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
$env:BROWSER = 'none'
Set-Location $PSScriptRoot
npx expo start --web --port 8082
