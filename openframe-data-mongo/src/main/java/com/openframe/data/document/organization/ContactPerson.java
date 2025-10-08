package com.openframe.data.document.organization;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Contact person information within an organization.
 * Embedded document, not a separate collection.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ContactPerson {
    
    /**
     * Contact person's full name
     */
    private String contactName;
    
    /**
     * Job title or position
     */
    private String title;
    
    /**
     * Phone number
     */
    private String phone;
    
    /**
     * Email address
     */
    private String email;
}
