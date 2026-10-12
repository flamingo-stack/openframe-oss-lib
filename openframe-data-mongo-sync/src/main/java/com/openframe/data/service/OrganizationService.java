package com.openframe.data.service;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.organization.OrganizationStatus;
import com.openframe.data.exception.OrganizationHasMachinesException;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.organization.OrganizationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;

// Service for managing Organization entities.
@Slf4j
@Service
@RequiredArgsConstructor
public class OrganizationService {

    // Name of the default organization created for each tenant; used as fallback for machines without a specific organization.
    public static final String DEFAULT_ORGANIZATION_NAME = "Default";

    private final OrganizationRepository organizationRepository;
    private final MachineRepository machineRepository;

    public boolean hasOrganization(String id) {
        log.debug("Checking existence of organization by ID: {}", id);
        return organizationRepository.findById(id)
                .filter(org -> !org.isDeleted())
                .isPresent();
    }

    public Organization organizationById(String id) {
        log.debug("Fetching organization by ID: {}", id);
        return organizationRepository.findById(id)
                .filter(org -> !org.isDeleted())
                .orElseThrow(() -> new IllegalArgumentException("Organization not found with id: " + id));
    }

    public boolean hasOrganizationByOrganizationId(String organizationId) {
        log.debug("Checking existence of organization by organizationId: {}", organizationId);
        return organizationRepository.findByOrganizationId(organizationId)
                .filter(org -> !org.isDeleted())
                .isPresent();
    }

    public Organization organizationByOrganizationId(String organizationId) {
        log.debug("Fetching organization by organizationId: {}", organizationId);
        return organizationRepository.findByOrganizationId(organizationId)
                .filter(org -> !org.isDeleted())
                .orElseThrow(() -> new IllegalArgumentException("Organization not found with organizationId: " + organizationId));
    }

    public boolean hasOrganizationByName(String name) {
        log.debug("Checking existence of organization by name: {}", name);
        return organizationRepository.findByName(name)
                .filter(org -> !org.isDeleted())
                .isPresent();
    }

    public Organization organizationByName(String name) {
        log.debug("Fetching organization by name: {}", name);
        return organizationRepository.findByName(name)
                .filter(org -> !org.isDeleted())
                .orElseThrow(() -> new IllegalArgumentException("Organization not found with name: " + name));
    }

    public boolean hasDefaultOrganization() {
        log.debug("Checking existence of default organization");
        return organizationRepository.findByIsDefaultTrue()
                .filter(org -> org.getStatus() == OrganizationStatus.ACTIVE)
                .isPresent();
    }

    public Organization defaultOrganization() {
        log.debug("Fetching default organization");
        return organizationRepository.findByIsDefaultTrue()
                .filter(org -> org.getStatus() == OrganizationStatus.ACTIVE)
                .orElseThrow(() -> new IllegalArgumentException("Default organization not found"));
    }

    public Organization createOrganization(Organization organization) {
        log.info("Creating new organization with organizationId: {}", organization.getOrganizationId());
        return organizationRepository.save(organization);
    }

    public Organization updateOrganization(Organization organization) {
        log.info("Updating organization with ID: {}", organization.getId());
        return organizationRepository.save(organization);
    }

    // Can archive only if all associated devices are ARCHIVED/DELETED (or no devices exist)
    public boolean canArchiveOrganization(String id) {
        Organization organization = organizationRepository.findByOrganizationId(id)
                .orElseThrow(() -> new IllegalArgumentException("Organization not found with id: " + id));

        var excludedStatuses = EnumSet.of(DeviceStatus.ARCHIVED, DeviceStatus.DELETED);
        return !machineRepository.existsByOrganizationIdAndStatusNotIn(organization.getOrganizationId(), excludedStatuses);
    }

    // Supports transitions: ACTIVE -> ARCHIVED (with device check) and ARCHIVED -> ACTIVE
    public void updateOrganizationStatus(String id, OrganizationStatus newStatus) {
        log.info("Attempting to update organization {} status to {}", id, newStatus);

        Organization organization = organizationRepository.findByOrganizationId(id)
                .orElseThrow(() -> new IllegalArgumentException("Organization not found with id: " + id));

        if (organization.getStatus() == newStatus) {
            log.warn("Organization {} is already in status {}", id, newStatus);
            throw new IllegalArgumentException("Organization is already in status " + newStatus);
        }

        if (organization.getIsDefault()) {
            log.warn("The default organization {} status cannot be changed", id);
            throw new IllegalArgumentException("The default organization status cannot be changed");
        }

        if (newStatus == OrganizationStatus.ARCHIVED) {
            // Check if any non-archived/non-deleted machines are associated with this organization
            var excludedStatuses = EnumSet.of(DeviceStatus.ARCHIVED, DeviceStatus.DELETED);
            if (machineRepository.existsByOrganizationIdAndStatusNotIn(organization.getOrganizationId(), excludedStatuses)) {
                log.warn("Cannot archive organization {} - has active devices", organization.getOrganizationId());
                throw new OrganizationHasMachinesException(organization.getOrganizationId());
            }
        }

        if (newStatus == OrganizationStatus.ACTIVE && !organization.isArchived()) {
            throw new IllegalArgumentException("Only archived organizations can be set to ACTIVE");
        }

        organization.setStatus(newStatus);
        organization.setStatusChangedAt(Instant.now());
        organizationRepository.save(organization);

        log.info("Successfully updated organization {} status to {}", id, newStatus);
    }

    // Deprecated: deletion unsupported — archived organizations must remain since DELETED devices may come back online
    @Deprecated
    public void deleteOrganization(String id) {
        log.info("Attempting to soft delete organization with ID: {}", id);

        Organization organization = organizationRepository.findByOrganizationId(id)
                .orElseThrow(() -> new IllegalArgumentException("Organization not found with id: " + id));

        if (organization.isDeleted()) {
            log.warn("Organization {} is already deleted", id);
            throw new IllegalArgumentException("Organization is already deleted: " + id);
        }

        if (organization.getIsDefault()) {
            log.warn("The default organization {} cannot be deleted", id);
            throw new IllegalArgumentException("The default organization cannot be deleted: " + id);
        }

        // Check if any machines are associated with this organization
        var excludedStatuses = EnumSet.of(DeviceStatus.ARCHIVED, DeviceStatus.DELETED);
        if (machineRepository.existsByOrganizationIdAndStatusNotIn(organization.getOrganizationId(), excludedStatuses)) {
            log.warn("Cannot delete organization {} - has active devices", organization.getOrganizationId());
            throw new OrganizationHasMachinesException(organization.getOrganizationId());
        }

        organization.setStatus(OrganizationStatus.DELETED);
        organization.setStatusChangedAt(Instant.now());
        organizationRepository.save(organization);

        log.info("Successfully soft deleted organization with ID: {}", id);
    }

    public void createDefaultOrganization() {
        log.info("Creating default organization");

        Organization defaultOrg = Organization.builder()
                .name(DEFAULT_ORGANIZATION_NAME)
                .organizationId(UUID.randomUUID().toString())
                .isDefault(true)
                .category("General")
                .status(OrganizationStatus.ACTIVE)
                .build();

        Organization created = createOrganization(defaultOrg);

        log.info("Created default organization '{}' with organizationId: {}",
                created.getName(), created.getOrganizationId());
    }

}
