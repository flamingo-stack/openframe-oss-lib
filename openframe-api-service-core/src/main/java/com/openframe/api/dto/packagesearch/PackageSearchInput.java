package com.openframe.api.dto.packagesearch;

import com.openframe.data.document.packagesearch.PackageManagerType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PackageSearchInput {

    private PackageManagerType packageManager;
    private String query;
    private Integer limit;
    private Integer offset;
}
