package com.openframe.client.service.rmm;

import com.openframe.data.document.device.chocolatey.ChocolateyStatus;
import com.openframe.data.document.device.chocolatey.MachineChocolatey;
import com.openframe.data.nats.rmm.model.MachinePackageManagersMessage;
import lombok.experimental.UtilityClass;

import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

@UtilityClass
final class ChocolateyReport {

    static MachineChocolatey toDocument(MachinePackageManagersMessage.Chocolatey reported) {
        ChocolateyStatus status = ChocolateyStatus.fromWire(reported.getStatus());
        return MachineChocolatey.builder()
                .version(reported.getVersion())
                .edition(reported.getEdition())
                .ours(reported.isOurs())
                .status(status)
                .reason(reported.getReason())
                .packages(reported.getPackages())
                .existingPackages(reported.getExistingPackages())
                .build();
    }

    static boolean isSame(MachineChocolatey reported, MachineChocolatey stored) {
        if (reported == null || stored == null) {
            return reported == stored;
        }
        return Objects.equals(reported.getVersion(), stored.getVersion())
                && Objects.equals(reported.getEdition(), stored.getEdition())
                && reported.isOurs() == stored.isOurs()
                && reported.getStatus() == stored.getStatus()
                && Objects.equals(reported.getReason(), stored.getReason())
                && sameIds(reported.getPackages(), stored.getPackages())
                && sameIds(reported.getExistingPackages(), stored.getExistingPackages());
    }

    private static boolean sameIds(List<String> first, List<String> second) {
        return idSet(first).equals(idSet(second));
    }

    private static Set<String> idSet(List<String> ids) {
        return ids == null ? Set.of() : new HashSet<>(ids);
    }
}
