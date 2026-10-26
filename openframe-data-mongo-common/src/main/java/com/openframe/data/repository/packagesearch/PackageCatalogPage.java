package com.openframe.data.repository.packagesearch;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PackageCatalogPage {

    private List<PackageCatalogHit> hits;
    private long total;
    private boolean hasMore;
}
