package com.openframe.data.document.organization;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * Contact information for an organization.
 * Includes contact persons and addresses.
 * Embedded document, not a separate collection.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ContactInformation {
    
    /**
     * List of contact persons
     */
    @Builder.Default
    private List<ContactPerson> contacts = new ArrayList<>();
    
    /**
     * Physical address of the organization
     */
    private Address physicalAddress;
    
    /**
     * Mailing address of the organization
     */
    private Address mailingAddress;
    
    /**
     * Flag indicating if mailing address is the same as physical address
     */
    @Builder.Default
    private Boolean mailingAddressSameAsPhysical = false;
}
