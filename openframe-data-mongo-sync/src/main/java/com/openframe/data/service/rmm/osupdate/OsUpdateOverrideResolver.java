package com.openframe.data.service.rmm.osupdate;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.osupdate.OsUpdateOverride;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Predicate;
import java.util.stream.Stream;

@Component
public class OsUpdateOverrideResolver {

    // The override of one update that applies to the device: its own, else the one of its customer, else the one
    // set for every customer.
    public Optional<OsUpdateOverride> resolve(Collection<OsUpdateOverride> overridesOfOsUpdate, Machine machine) {
        Predicate<OsUpdateOverride> ofDevice = osUpdateOverride ->
                Objects.equals(osUpdateOverride.getMachineId(), machine.getMachineId());
        Predicate<OsUpdateOverride> ofCustomer = osUpdateOverride -> osUpdateOverride.getMachineId() == null
                && osUpdateOverride.getOrganizationId() != null
                && osUpdateOverride.getOrganizationId().equals(machine.getOrganizationId());
        Predicate<OsUpdateOverride> ofEveryCustomer = osUpdateOverride ->
                osUpdateOverride.getMachineId() == null && osUpdateOverride.getOrganizationId() == null;
        return Stream.of(ofDevice, ofCustomer, ofEveryCustomer)
                .map(scope -> overridesOfOsUpdate.stream().filter(scope).findFirst())
                .flatMap(Optional::stream)
                .findFirst();
    }
}
