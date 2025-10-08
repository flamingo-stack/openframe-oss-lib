package com.openframe.api.mapper;

import com.openframe.api.dto.organization.*;
import com.openframe.data.document.organization.*;
import org.springframework.stereotype.Component;

import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Shared mapper for organization DTOs and entities.
 * Used by both GraphQL and REST APIs.
 */
@Component
public class OrganizationMapper {

    /**
     * Convert CreateOrganizationRequest to Organization entity.
     * Generates organizationId automatically as UUID.
     */
    public Organization toEntity(CreateOrganizationRequest request) {
        if (request == null) {
            return null;
        }

        return Organization.builder()
                .name(request.name())
                .organizationId(generateOrganizationId())
                .category(request.category())
                .numberOfEmployees(request.numberOfEmployees())
                .websiteUrl(request.websiteUrl())
                .notes(request.notes())
                .contactInformation(toContactInformationEntity(request.contactInformation()))
                .monthlyRevenue(request.monthlyRevenue())
                .contractStartDate(request.contractStartDate())
                .contractEndDate(request.contractEndDate())
                .deleted(false)
                .build();
    }

    /**
     * Generate unique organizationId as UUID.
     */
    private String generateOrganizationId() {
        return UUID.randomUUID().toString();
    }

    /**
     * Update Organization entity from UpdateOrganizationRequest.
     * Only updates non-null fields from the request (partial update).
     * 
     * Note: organizationId cannot be updated - it's immutable once created.
     */
    public Organization updateEntity(Organization existing, UpdateOrganizationRequest request) {
        if (request == null) {
            return existing;
        }

        // Update only allowed fields (organizationId is immutable)
        if (request.name() != null) {
            existing.setName(request.name());
        }
        if (request.category() != null) {
            existing.setCategory(request.category());
        }
        if (request.numberOfEmployees() != null) {
            existing.setNumberOfEmployees(request.numberOfEmployees());
        }
        if (request.websiteUrl() != null) {
            existing.setWebsiteUrl(request.websiteUrl());
        }
        if (request.notes() != null) {
            existing.setNotes(request.notes());
        }
        if (request.contactInformation() != null) {
            existing.setContactInformation(toContactInformationEntity(request.contactInformation()));
        }
        if (request.monthlyRevenue() != null) {
            existing.setMonthlyRevenue(request.monthlyRevenue());
        }
        if (request.contractStartDate() != null) {
            existing.setContractStartDate(request.contractStartDate());
        }
        if (request.contractEndDate() != null) {
            existing.setContractEndDate(request.contractEndDate());
        }

        return existing;
    }

    /**
     * Convert Organization entity to OrganizationResponse DTO.
     */
    public OrganizationResponse toResponse(Organization organization) {
        if (organization == null) {
            return null;
        }

        return OrganizationResponse.builder()
                .id(organization.getId())
                .name(organization.getName())
                .organizationId(organization.getOrganizationId())
                .category(organization.getCategory())
                .numberOfEmployees(organization.getNumberOfEmployees())
                .websiteUrl(organization.getWebsiteUrl())
                .notes(organization.getNotes())
                .contactInformation(toContactInformationDto(organization.getContactInformation()))
                .monthlyRevenue(organization.getMonthlyRevenue())
                .contractStartDate(organization.getContractStartDate())
                .contractEndDate(organization.getContractEndDate())
                .createdAt(organization.getCreatedAt())
                .updatedAt(organization.getUpdatedAt())
                .deleted(organization.getDeleted())
                .deletedAt(organization.getDeletedAt())
                .build();
    }

    // --- Contact Information Mapping ---

    private ContactInformation toContactInformationEntity(ContactInformationDto dto) {
        if (dto == null) {
            return null;
        }

        Address physicalAddress = toAddressEntity(dto.physicalAddress());
        Address mailingAddress;
        
        // If mailingAddressSameAsPhysical is true, copy physical address to mailing address
        if (Boolean.TRUE.equals(dto.mailingAddressSameAsPhysical())) {
            mailingAddress = copyAddress(physicalAddress);
        } else {
            mailingAddress = toAddressEntity(dto.mailingAddress());
        }

        return ContactInformation.builder()
                .contacts(dto.contacts() != null 
                        ? dto.contacts().stream().map(this::toContactPersonEntity).collect(Collectors.toList())
                        : null)
                .physicalAddress(physicalAddress)
                .mailingAddress(mailingAddress)
                .mailingAddressSameAsPhysical(dto.mailingAddressSameAsPhysical())
                .build();
    }

    private ContactPerson toContactPersonEntity(ContactPersonDto dto) {
        if (dto == null) {
            return null;
        }

        return ContactPerson.builder()
                .contactName(dto.contactName())
                .title(dto.title())
                .phone(dto.phone())
                .email(dto.email())
                .build();
    }

    private Address toAddressEntity(AddressDto dto) {
        if (dto == null) {
            return null;
        }

        return Address.builder()
                .street1(dto.street1())
                .street2(dto.street2())
                .city(dto.city())
                .state(dto.state())
                .postalCode(dto.postalCode())
                .country(dto.country())
                .build();
    }

    private ContactInformationDto toContactInformationDto(ContactInformation entity) {
        if (entity == null) {
            return null;
        }

        return ContactInformationDto.builder()
                .contacts(entity.getContacts() != null
                        ? entity.getContacts().stream().map(this::toContactPersonDto).collect(Collectors.toList())
                        : null)
                .physicalAddress(toAddressDto(entity.getPhysicalAddress()))
                .mailingAddress(toAddressDto(entity.getMailingAddress()))
                .mailingAddressSameAsPhysical(entity.getMailingAddressSameAsPhysical())
                .build();
    }

    private ContactPersonDto toContactPersonDto(ContactPerson entity) {
        if (entity == null) {
            return null;
        }

        return ContactPersonDto.builder()
                .contactName(entity.getContactName())
                .title(entity.getTitle())
                .phone(entity.getPhone())
                .email(entity.getEmail())
                .build();
    }

    private AddressDto toAddressDto(Address entity) {
        if (entity == null) {
            return null;
        }

        return AddressDto.builder()
                .street1(entity.getStreet1())
                .street2(entity.getStreet2())
                .city(entity.getCity())
                .state(entity.getState())
                .postalCode(entity.getPostalCode())
                .country(entity.getCountry())
                .build();
    }

    /**
     * Create a copy of an address.
     * Used when mailingAddressSameAsPhysical is true.
     */
    private Address copyAddress(Address source) {
        if (source == null) {
            return null;
        }

        return Address.builder()
                .street1(source.getStreet1())
                .street2(source.getStreet2())
                .city(source.getCity())
                .state(source.getState())
                .postalCode(source.getPostalCode())
                .country(source.getCountry())
                .build();
    }
}
