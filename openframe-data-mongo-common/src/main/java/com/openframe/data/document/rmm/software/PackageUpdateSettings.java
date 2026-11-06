package com.openframe.data.document.rmm.software;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PackageUpdateSettings {

    private PackageUpdateMode mode;

    private Long deadlineSeconds;

    private Integer countdownSeconds;
}
