package com.openframe.data.nats.packageupdate;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.PackageUpdateMode;
import com.openframe.data.document.rmm.software.PackageUpdateSource;
import com.openframe.data.nats.delivery.PackageUpdateDeliverySeed;
import lombok.experimental.UtilityClass;

@UtilityClass
public class PackageUpdateWire {

    public UpdateSource source(PackageUpdateSource source) {
        return switch (source) {
            case AUTO -> UpdateSource.builder().kind(UpdateSource.Kind.AUTO).build();
            case ADMIN -> UpdateSource.builder().kind(UpdateSource.Kind.MANUAL).origin(UpdateSource.Origin.ADMIN).build();
            case USER -> UpdateSource.builder().kind(UpdateSource.Kind.MANUAL).origin(UpdateSource.Origin.USER).build();
        };
    }

    public UpdateMode mode(PackageUpdateMode mode) {
        return mode == PackageUpdateMode.FORCE ? UpdateMode.FORCE : UpdateMode.WAIT;
    }

    public PackageReference reference(PackageManagerType manager, String packageName, BrewPackageType brewPackageType) {
        PackageReference.PackageReferenceBuilder ref = PackageReference.builder().manager(manager);
        if (manager == PackageManagerType.BREW) {
            return ref.kind(brewPackageType).name(packageName).build();
        }
        return ref.id(packageName).build();
    }

    public PackageUpdateDeliverySeed seed(String machineId, String requestId, PackageUpdateSource source,
                                          PackageManagerType manager, String packageName, BrewPackageType brewPackageType,
                                          PackageUpdateMode mode, Integer forceCountdownSeconds) {
        UpdateMode wireMode = mode(mode);
        return PackageUpdateDeliverySeed.builder()
                .machineId(machineId)
                .requestId(requestId)
                .source(source(source))
                .packageRef(reference(manager, packageName, brewPackageType))
                .mode(wireMode)
                .countdownSeconds(wireMode == UpdateMode.FORCE ? forceCountdownSeconds : null)
                .build();
    }
}
