package com.openframe.data.document.organization;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Address information.
 * Embedded document, not a separate collection.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Address {
    
    /**
     * Street address line 1
     */
    private String street1;
    
    /**
     * Street address line 2 (optional)
     */
    private String street2;
    
    /**
     * City
     */
    private String city;
    
    /**
     * State or province
     */
    private String state;
    
    /**
     * Postal or ZIP code
     */
    private String postalCode;
    
    /**
     * Country
     */
    private String country;
}
