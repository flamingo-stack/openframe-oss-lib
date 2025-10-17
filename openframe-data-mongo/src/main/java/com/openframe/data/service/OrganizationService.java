package com.openframe.data.service;

import com.openframe.data.document.organization.Organization;
import com.openframe.data.exception.OrganizationHasMachinesException;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.organization.OrganizationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Service for managing Organization entities.
 * Provides business logic and operations for organizations.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class OrganizationService {

    /**
     * Name of the default organization created for each tenant.
     * This organization is used as fallback for machines without specific organization.
     */
    public static final String DEFAULT_ORGANIZATION_NAME = "Default";

    private final OrganizationRepository organizationRepository;
    private final MachineRepository machineRepository;

    /**
     * Get organization by ID (excluding soft deleted)
     * @param id organization document ID
     * @return Optional containing the organization if found and not deleted
     */
    public Optional<Organization> getOrganizationById(String id) {
        log.debug("Fetching organization by ID: {}", id);
        return organizationRepository.findById(id)
                .filter(org -> !org.isDeleted());
    }

    /**
     * Get organization by organizationId (excluding soft deleted)
     * @param organizationId unique organization identifier
     * @return Optional containing the organization if found and not deleted
     */
    public Optional<Organization> getOrganizationByOrganizationId(String organizationId) {
        log.debug("Fetching organization by organizationId: {}", organizationId);
        return organizationRepository.findByOrganizationId(organizationId)
                .filter(org -> !org.isDeleted());
    }

    /**
     * Get organization by name (excluding soft deleted)
     * @param name organization name
     * @return Optional containing the organization if found and not deleted
     */
    public Optional<Organization> getOrganizationByName(String name) {
        log.debug("Fetching organization by name: {}", name);
        return organizationRepository.findByName(name)
                .filter(org -> !org.isDeleted());
    }

    /**
     * Get the default organization (excluding soft deleted)
     * @return Optional containing the default organization if found and not deleted
     */
    public Optional<Organization> getDefaultOrganization() {
        log.debug("Fetching default organization");
        return organizationRepository.findByIsDefaultTrue()
                .filter(org -> !org.isDeleted());
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
     * Soft delete organization by ID.
     * Checks if any machines are associated with this organization before deletion.
     * 
     * @param id organization document ID
     * @throws OrganizationHasMachinesException if machines are associated with this organization
     */
    public void deleteOrganization(String id) {
        log.info("Attempting to soft delete organization with ID: {}", id);
        
        // Get organization to retrieve organizationId
        Organization organization = organizationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Organization not found with id: " + id));
        
        // Check if already deleted
        if (organization.isDeleted()) {
            log.warn("Organization {} is already deleted", id);
            throw new IllegalArgumentException("Organization is already deleted: " + id);
        }

        // Check if already deleted
        if (organization.getIsDefault()) {
            log.warn("The default organization {} cannot be deleted", id);
            throw new IllegalArgumentException("The default organization {} cannot be deleted: " + id);
        }
        
        // Check if any machines are associated with this organization
        if (machineRepository.existsByOrganizationId(organization.getOrganizationId())) {
            log.warn("Cannot delete organization {} - has associated machines", organization.getOrganizationId());
            throw new OrganizationHasMachinesException(organization.getOrganizationId());
        }
        
        // Soft delete: mark as deleted instead of removing from database
        organization.setDeleted(true);
        organization.setDeletedAt(java.time.Instant.now());
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
                .deleted(false)
                .build();

        Organization created = createOrganization(defaultOrg);

        log.info("Created default organization '{}' with organizationId: {}",
                created.getName(), created.getOrganizationId());
    }

}

