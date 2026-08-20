$path = 'C:\Users\ANISH\Documents\WEBCAMPUS\webcampus\packages\ui\src\styles\globals.css'
$text = [System.IO.File]::ReadAllText($path)
$marker = '/* Global application-wide admissions design language. */'
$index = $text.IndexOf($marker)
if ($index -ge 0) {
  $text = $text.Substring(0, $index).TrimEnd() + [Environment]::NewLine
  [System.IO.File]::WriteAllText($path, $text)
}
