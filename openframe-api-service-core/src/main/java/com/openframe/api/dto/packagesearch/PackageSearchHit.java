package com.openframe.api.dto.packagesearch;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PackageSearchHit {

    private PackageSearchItem item;
    private String cursor;
}
