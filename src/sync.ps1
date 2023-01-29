param($srcbase='__none__', $destbase='__none__') 

    Write-Host "==============="

    $SourceFolder = "$($srcbase)"
    $DestinationFolder = "$($destbase)"

    # Write-Host " SourceFolder---: $($SourceFolder)  -----"
    # Write-Host " DestinationFolder---: $($DestinationFolder)  --"

    Robocopy $SourceFolder $DestinationFolder /MIR /XA:SH /XJD /R:5 /W:15 /MT:128 /V /NP

