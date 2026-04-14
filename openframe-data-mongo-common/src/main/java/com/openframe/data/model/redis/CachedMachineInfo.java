package com.openframe.data.model.redis;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

/**
 * Lightweight DTO for caching machine information in Redis
 * Contains only essential fields to avoid serialization issues and reduce cache size
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CachedMachineInfo implements Serializable {
    private static final long serialVersionUID = 1L;
    
    private String machineId;
    private String hostname;
    private String organizationId;
}

