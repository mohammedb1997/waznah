param(
  [string]$BaseUrl = 'https://armful-gumming-germless.ngrok-free.dev',
  [string]$Origin = 'https://mohammedb1997.github.io'
)

$ErrorActionPreference = 'Stop'
$BaseUrl = $BaseUrl.TrimEnd('/')

function Test-Http {
  param(
    [Parameter(Mandatory=$true)]
    [string]$Method,

    [Parameter(Mandatory=$true)]
    [string]$Uri,

    [hashtable]$Headers = @{},

    [AllowNull()]
    [string]$Body = $null
  )

  $request = $null
  $response = $null

  try {
    $request = [System.Net.HttpWebRequest]::Create($Uri)
    $request.Method = $Method
    $request.Timeout = 20000
    $request.ReadWriteTimeout = 20000
    $request.AllowAutoRedirect = $true

    # Add request headers.
    foreach ($key in $Headers.Keys) {
      $value = [string]$Headers[$key]

      if ($key -ieq 'Accept') {
        $request.Accept = $value
      }
      elseif ($key -ieq 'Content-Type') {
        $request.ContentType = $value
      }
      else {
        $request.Headers.Add($key, $value)
      }
    }

    # Only send a body when one was explicitly provided.
    if ($null -ne $Body -and $Body.Length -gt 0) {
      $bytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
      $request.ContentLength = $bytes.Length

      $stream = $request.GetRequestStream()
      try {
        $stream.Write($bytes, 0, $bytes.Length)
      }
      finally {
        $stream.Dispose()
      }
    }

    $response = $request.GetResponse()

    $headersOut = @{}

    foreach ($key in $response.Headers.AllKeys) {
      $headersOut[$key] = $response.Headers[$key]
    }

    $responseBody = ''

    try {
      $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
      try {
        $responseBody = $reader.ReadToEnd()
      }
      finally {
        $reader.Dispose()
      }
    }
    catch {}

    return [pscustomobject]@{
      Status  = [int]$response.StatusCode
      Headers = $headersOut
      Body    = $responseBody
    }
  }
  catch [System.Net.WebException] {
    $webResponse = $_.Exception.Response

    if ($null -ne $webResponse) {
      $headersOut = @{}

      foreach ($key in $webResponse.Headers.AllKeys) {
        $headersOut[$key] = $webResponse.Headers[$key]
      }

      $responseBody = ''

      try {
        $reader = New-Object System.IO.StreamReader($webResponse.GetResponseStream())
        try {
          $responseBody = $reader.ReadToEnd()
        }
        finally {
          $reader.Dispose()
        }
      }
      catch {}

      $status = 0

      try {
        $status = [int]$webResponse.StatusCode
      }
      catch {}

      return [pscustomobject]@{
        Status  = $status
        Headers = $headersOut
        Body    = $responseBody
      }
    }

    return [pscustomobject]@{
      Status  = 0
      Headers = @{}
      Body    = $_.Exception.Message
    }
  }
  catch {
    return [pscustomobject]@{
      Status  = 0
      Headers = @{}
      Body    = $_.Exception.Message
    }
  }
  finally {
    if ($null -ne $response) {
      $response.Dispose()
    }
  }
}


Write-Host "=== Waznah live integration test ===" -ForegroundColor Cyan
Write-Host "BaseUrl: $BaseUrl"
Write-Host "Origin : $Origin"

$failures = New-Object System.Collections.Generic.List[string]


# ============================================================
# 1. PocketBase Health
# ============================================================

$r = Test-Http `
  -Method 'GET' `
  -Uri "$BaseUrl/api/health"

Write-Host "[1] PocketBase /api/health => $($r.Status)"

if ($r.Status -ne 200) {
  Write-Host $r.Body -ForegroundColor Yellow
  $failures.Add("PocketBase health endpoint did not return HTTP 200.")
}


# ============================================================
# 2. CORS Allowed Origin
# ============================================================

$r = Test-Http `
  -Method 'OPTIONS' `
  -Uri "$BaseUrl/api/collections/moka_teas/records" `
  -Headers @{
    'Origin' = $Origin
    'Access-Control-Request-Method' = 'GET'
    'Access-Control-Request-Headers' = 'content-type'
  }

$acao = ''

if ($r.Headers.ContainsKey('Access-Control-Allow-Origin')) {
  $acao = [string]$r.Headers['Access-Control-Allow-Origin']
}

Write-Host "[2] CORS preflight (allowed origin) => $($r.Status)"
Write-Host "    ACAO: $acao"

if ($r.Status -ne 204 -or $acao -ne $Origin) {
  $failures.Add(
    "Allowed-origin CORS is not locked to the expected origin (expected 204 + ACAO=$Origin)."
  )
}


# ============================================================
# 3. CORS Disallowed Origin
# ============================================================

$r = Test-Http `
  -Method 'OPTIONS' `
  -Uri "$BaseUrl/api/collections/moka_teas/records" `
  -Headers @{
    'Origin' = 'https://evil.example'
    'Access-Control-Request-Method' = 'GET'
    'Access-Control-Request-Headers' = 'content-type'
  }

$badAca = ''

if ($r.Headers.ContainsKey('Access-Control-Allow-Origin')) {
  $badAca = [string]$r.Headers['Access-Control-Allow-Origin']
}

Write-Host "[3] CORS preflight (disallowed origin) => $($r.Status)"
Write-Host "    ACAO: $badAca"

if (($r.Status -ge 200 -and $r.Status -lt 300) -and $badAca -eq 'https://evil.example') {
  $failures.Add('Disallowed Origin was granted CORS access.')
}
elseif (($r.Status -eq 204) -and ($badAca -eq '*')) {
  $failures.Add('PocketBase still exposes wildcard CORS; disallowed preflight is effectively accepted.')
}


# ============================================================
# 4. Public Collection Read
# ============================================================

$r = Test-Http `
  -Method 'GET' `
  -Uri "$BaseUrl/api/collections/moka_teas/records?perPage=1" `
  -Headers @{
    'Origin' = $Origin
    'Accept' = 'application/json'
  }

Write-Host "[4] Public tea collection read => $($r.Status)"

if ($r.Status -eq 200) {
  try {
    $j = $r.Body | ConvertFrom-Json

    Write-Host "    items: $(@($j.items).Count) / totalItems: $($j.totalItems)"
  }
  catch {
    Write-Host "    Response received but JSON parsing failed." -ForegroundColor Yellow
  }
}
else {
  Write-Host $r.Body -ForegroundColor Yellow
  $failures.Add("Public tea collection read did not return HTTP 200.")
}


# ============================================================
# 5. Direct Superuser Endpoint — Diagnostic Only
# ============================================================

Write-Host "[5] Direct Superuser auth exposure test" -ForegroundColor Cyan

$email = Read-Host 'Superuser email (Enter to skip)'

if ($email) {

  $secure = Read-Host 'Superuser password' -AsSecureString

  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)

  try {
    $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }

  $body = @{
    identity = $email
    password = $password
  } | ConvertTo-Json -Compress

  $r = Test-Http `
    -Method 'POST' `
    -Uri "$BaseUrl/api/collections/_superusers/auth-with-password" `
    -Headers @{
      'Origin' = $Origin
      'Accept' = 'application/json'
      'Content-Type' = 'application/json'
    } `
    -Body $body

  Write-Host "    direct PocketBase superuser auth => $($r.Status)"

  if ($r.Status -eq 200) {
    Write-Host '    WARNING: direct Superuser auth is publicly reachable. Keep BFF, and put PocketBase behind a reverse proxy/firewall before production.' -ForegroundColor Yellow
  }
}


# ============================================================
# Final Result
# ============================================================

if ($failures.Count -gt 0) {

  Write-Host "=== FAIL: $($failures.Count) issue(s) ===" -ForegroundColor Red

  $failures | ForEach-Object {
    Write-Host " - $_" -ForegroundColor Red
  }

  exit 1
}

Write-Host '=== PASS: no CORS validation failures ===' -ForegroundColor Green
Write-Host "=== End ===" -ForegroundColor Cyan