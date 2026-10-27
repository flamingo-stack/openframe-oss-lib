package com.openframe.processing.config.properties;

import jakarta.validation.constraints.Positive;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Data
@Validated
@ConfigurationProperties(prefix = "openframe.events.processing.large-updates")
public class LargeUpdateProperties {

    // An event that changes this many items or more goes to a projection task instead of one inline write; Mongo counts without a limit at 0.
    @Positive
    private int inlineLimit = 5000;
}
