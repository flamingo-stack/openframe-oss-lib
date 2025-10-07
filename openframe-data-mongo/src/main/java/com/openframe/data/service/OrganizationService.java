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
import java.util.stream.Collectors;

/**
 * Service for managing Organization entities.
 * Provides business logic and operations for organizations.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class OrganizationService {

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
     * Batch load organization names for multiple organizationIds (for DataLoader).
     * Performs a single efficient MongoDB query with index lookup.
     * Returns organization names in the same order as the input organizationIds.
     * Returns null for organizationIds that don't exist.
     * 
     * Performance: MongoDB index scan on organizationId: 1-5ms for typical loads
     * 
     * @param organizationIds list of organization identifiers
     * @return list of organization names (or null) in the same order as input
     */
    public List<String> getOrganizationNamesForOrganizationIds(List<String> organizationIds) {
        log.debug("Batch loading organization names for {} organizationIds", organizationIds.size());

        if (organizationIds.isEmpty()) {
            return new ArrayList<>();
        }

        // Filter out nulls and collect to Set (ensures uniqueness)
        var nonNullIds = organizationIds.stream()
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        if (nonNullIds.isEmpty()) {
            return organizationIds.stream()
                    .map(id -> (String) null)
                    .collect(Collectors.toList());
        }

        // Batch query with Set (more efficient than List for IN queries)
        List<Organization> organizations = organizationRepository.findByOrganizationIdIn(nonNullIds);
        Map<String, String> namesByOrgId = organizations.stream()
                .collect(Collectors.toMap(
                        Organization::getOrganizationId,
                        Organization::getName
                ));

        return organizationIds.stream()
                .map(orgId -> orgId == null ? null : namesByOrgId.get(orgId))
                .collect(Collectors.toList());
    }
}

