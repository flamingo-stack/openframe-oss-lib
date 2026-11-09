package com.openframe.data.service.rmm.software.matching;

import com.openframe.data.document.rmm.software.FleetSource;
import com.openframe.data.document.rmm.software.SoftwarePackageMatch;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

// a program as Fleet reports it, with the keys a package manager correlates it by; compared by identity on purpose,
// two devices can report equal programs
@Getter
@Builder
public class InstalledProgram {

    private final FleetSource fleetSource;
    private final String name;
    private final String publisher;
    private final String upgradeCode;
    @Builder.Default
    private final List<String> productCodes = List.of();
    @Builder.Default
    private final List<String> packageFamilyNames = List.of();
    private final boolean systemComponent;
    // what the read model stored for the program when it was projected; null when it was never matched
    private final SoftwarePackageMatch storedMatch;
}
