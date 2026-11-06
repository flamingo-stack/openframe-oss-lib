package com.openframe.data.document.rmm.software;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SoftwareAutoUpdate {

    private boolean enabled;

    private PackageUpdateSettings settings;

    // no settings of its own = "Same settings for auto-update"
    public PackageUpdateSettings settingsOr(PackageUpdateSettings updateSettings) {
        return settings != null ? settings : updateSettings;
    }
}
