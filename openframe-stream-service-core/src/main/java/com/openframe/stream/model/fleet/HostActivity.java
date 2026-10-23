package com.openframe.stream.model.fleet;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HostActivity {
    @JsonProperty("host_id")
    private Integer hostId;
    
    @JsonProperty("activity_id")
    private Integer activityId;
} 
