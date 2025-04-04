function Show-Tree {
    param($path, $prefix = "")
    $items = Get-ChildItem -LiteralPath $path -Force | Where-Object {
        $_.Name -notmatch '^(node_modules|__pycache__|\.|@)'
    } | Sort-Object { $_.PSIsContainer -notmatch 'True' }, Name  # Thu m?c lên tru?c

    for ($i = 0; $i -lt $items.Count; $i++) {
        $item = $items[$i]
        $isLast = $i -eq $items.Count - 1
        $marker = if ($isLast) { "+-- " } else { "+-- " }
        "$prefix$marker$($item.Name)" | Add-Content folder_structure.txt

        if ($item.PSIsContainer) {
            $newPrefix = if ($isLast) { "$prefix    " } else { "$prefix¦   " }
            Show-Tree -path $item.FullName -prefix $newPrefix
        }
    }
}

Remove-Item folder_structure.txt -ErrorAction Ignore
Show-Tree "."
