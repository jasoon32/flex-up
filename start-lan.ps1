# Starts the Expo dev server on your local network (phone and PC on the same Wi-Fi).
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
Set-Location $PSScriptRoot
npx expo start --lan
