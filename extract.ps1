param([Parameter(Mandatory=$true)][string]$Source)
Add-Type -AssemblyName System.IO.Compression
function Read-Entry($zip, $name) {
  $entry = $zip.GetEntry($name)
  if (!$entry) { return $null }
  $reader = [IO.StreamReader]::new($entry.Open())
  try { return [xml]$reader.ReadToEnd() } finally { $reader.Dispose() }
}
$results = @(foreach ($file in Get-ChildItem -LiteralPath $Source -Filter '*.xlsx') {
  $zip = [IO.Compression.ZipFile]::OpenRead($file.FullName)
  try {
    $stringsXml = Read-Entry $zip 'xl/sharedStrings.xml'
    $strings = @($stringsXml.sst.si | ForEach-Object { ($_.InnerText) })
    $sheets = @()
    foreach ($entry in $zip.Entries | Where-Object FullName -match '^xl/worksheets/sheet\d+\.xml$') {
      $sheet = Read-Entry $zip $entry.FullName
      $rows = @()
      foreach ($row in $sheet.worksheet.sheetData.row) {
        $cells = [ordered]@{}
        foreach ($cell in $row.c) {
          $v = if ($cell.t -eq 's') { $strings[[int]$cell.v] } elseif ($cell.t -eq 'inlineStr') { $cell.is.InnerText } else { [string]$cell.v }
          if ($v) { $cells[$cell.r] = $v }
        }
        if ($cells.Count) { $rows += [pscustomobject]@{ row = [int]$row.r; cells = $cells } }
      }
      $sheets += [pscustomobject]@{ sheet = $entry.FullName; rows = $rows }
    }
    [pscustomobject]@{ file = $file.Name; sheets = $sheets }
  } finally { $zip.Dispose() }
})
$results | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath "$PSScriptRoot/raw.json" -Encoding utf8
