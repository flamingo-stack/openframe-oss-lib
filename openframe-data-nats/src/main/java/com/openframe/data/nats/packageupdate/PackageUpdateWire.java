package com.openframe.data.nats.packageupdate;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.PackageUpdateMode;
import com.openframe.data.document.rmm.software.PackageUpdateRequest;
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

    public PackageReference reference(PackageManagerType manager, String packageName, BrewPackageType brewPackageType) {
        PackageReference.PackageReferenceBuilder ref = PackageReference.builder().manager(manager);
        if (manager == PackageManagerType.BREW) {
            return ref.kind(brewPackageType).name(packageName).build();
        }
        return ref.id(packageName).build();
    }

    public PackageUpdateDeliverySeed seed(String machineId, PackageUpdateRequest request) {
        PackageUpdateMode mode = request.getMode();
        UpdateSource source = source(request.getSource());
        PackageReference packageRef =
                reference(request.getPackageManager(), request.getPackageName(), request.getBrewPackageType());
        return PackageUpdateDeliverySeed.builder()
                .machineId(machineId)
                .requestId(request.getRequestId())
                .source(source)
                .packageRef(packageRef)
                .mode(mode)
                .countdownSeconds(mode == PackageUpdateMode.FORCE ? request.getForceCountdownSeconds() : null)
                .deadlineSeconds(mode == PackageUpdateMode.WAIT ? request.getDeadlineSeconds() : null)
                .build();
    }

    public PackageUpdateDeliverySeed deadlineForce(String machineId, PackageUpdateRequest request) {
        return seed(machineId, request)
                .toBuilder()
                .mode(PackageUpdateMode.FORCE)
                .countdownSeconds(request.getForceCountdownSeconds())
                .deadlineSeconds(null)
                .deadlineForce(true)
                .build();
    }

    // origin USER is what keeps the countdown at zero: the agent raises it to its minimum for any other origin
    public PackageUpdateDeliverySeed approvedForce(String machineId, PackageUpdateRequest request) {
        PackageUpdateDeliverySeed force = deadlineForce(machineId, request);
        UpdateSource.Kind kind = force.getSource().getKind();
        UpdateSource approvedByUser = UpdateSource.builder().kind(kind).origin(UpdateSource.Origin.USER).build();
        return force.toBuilder()
                .source(approvedByUser)
                .countdownSeconds(0)
                .build();
    }
}
