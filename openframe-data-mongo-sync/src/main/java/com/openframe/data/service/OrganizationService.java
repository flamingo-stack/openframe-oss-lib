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

/**
 * Service for managing Organization entities.
 * Provides business logic and operations for organizations.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrganizationService {

    /**
     * Name of the default organization created for each tenant.
     * This organization is used as fallback for machines without specific organization.
     */
    public static final String DEFAULT_ORGANIZATION_NAME = "Default";

    private final OrganizationRepository organizationRepository;
    private final MachineRepository machineRepository;

    /**
     * Get organization by ID (excluding deleted)
     * @param id organization document ID
     * @return Optional containing the organization if found and not deleted
     */
    public Optional<Organization> getOrganizationById(String id) {
        log.debug("Fetching organization by ID: {}", id);
        return organizationRepository.findById(id)
                .filter(org -> !org.isDeleted());
    }

    /**
     * Get organization by organizationId (excluding deleted)
     * @param organizationId unique organization identifier
     * @return Optional containing the organization if found and not deleted
     */
    public Optional<Organization> getOrganizationByOrganizationId(String organizationId) {
        log.debug("Fetching organization by organizationId: {}", organizationId);
        return organizationRepository.findByOrganizationId(organizationId)
                .filter(org -> !org.isDeleted());
    }

    /**
     * Get organization by name (excluding deleted)
     * @param name organization name
     * @return Optional containing the organization if found and not deleted
     */
    public Optional<Organization> getOrganizationByName(String name) {
        log.debug("Fetching organization by name: {}", name);
        return organizationRepository.findByName(name)
                .filter(org -> !org.isDeleted());
    }

    /**
     * Get the default organization (excluding deleted and archived)
     * @return Optional containing the default organization if found and active
     */
    public Optional<Organization> getDefaultOrganization() {
        log.debug("Fetching default organization");
        return organizationRepository.findByIsDefaultTrue()
                .filter(org -> org.getStatus() == OrganizationStatus.ACTIVE);
    }

    /**
     * Create a new organization
     * @param organization organization to create
     * @return saved organization
     */
    public Organization createOrganization(Organization organization) {
        log.info("Creating new organization with organizationId: {}", organization.getOrganizationId());
        return organizationRepository.save(organization);
    }

    /**
     * Update an existing organization
     * @param organization organization with updated data
     * @return updated organization
     */
    public Organization updateOrganization(Organization organization) {
        log.info("Updating organization with ID: {}", organization.getId());
        return organizationRepository.save(organization);
    }

    /**
     * Check if an organization can be archived.
     * Returns true if all associated devices are in ARCHIVED or DELETED status (or no devices exist).
     *
     * @param id organization document ID
     * @return true if organization can be archived
     */
    public boolean canArchiveOrganization(String id) {
        Organization organization = organizationRepository.findByOrganizationId(id)
                .orElseThrow(() -> new IllegalArgumentException("Organization not found with id: " + id));

        var excludedStatuses = EnumSet.of(DeviceStatus.ARCHIVED, DeviceStatus.DELETED);
        return !machineRepository.existsByOrganizationIdAndStatusNotIn(organization.getOrganizationId(), excludedStatuses);
    }

    /**
     * Update organization status.
     * Supports transitions: ACTIVE → ARCHIVED (with device check) and ARCHIVED → ACTIVE.
     *
     * @param id organization document ID
     * @param newStatus target status (ACTIVE or ARCHIVED)
     * @throws OrganizationHasMachinesException if archiving and organization has active devices
     */
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

    /**
     * Soft delete organization by ID.
     * Checks if any machines are associated with this organization before deletion.
     *
     * @param id organization document ID
     * @throws OrganizationHasMachinesException if machines are associated with this organization
     * @deprecated Use {@link #archiveOrganization(String)} instead. Deletion is not supported — archived
     * organizations must remain in the database because devices with DELETED status may come back online.
     */
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

    /**
     * Create a default organization for a newly registered tenant.
     * This organization will be used for machines that don't have a specific organization assigned.
     *
     * The default organization has:
     * - name: {@link OrganizationService#DEFAULT_ORGANIZATION_NAME}
     * - category: "General"
     * - auto-generated organizationId (UUID)
     */
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
