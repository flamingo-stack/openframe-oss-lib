.Results[]? as $r
| (($r.Vulnerabilities // [])[] | [.Severity, .PkgName, .InstalledVersion, (.FixedVersion // "-"), .VulnerabilityID, (.PkgPath // $r.Target)]),
  (($r.Misconfigurations // [])[] | [.Severity, .Title, "-", "-", .ID, $r.Target])
| @tsv
