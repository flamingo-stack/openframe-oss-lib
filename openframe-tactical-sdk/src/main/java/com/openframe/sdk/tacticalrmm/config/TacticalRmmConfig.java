package com.openframe.sdk.tacticalrmm.config;

import com.openframe.sdk.tacticalrmm.TacticalRmmClient;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.context.annotation.Bean;

@AutoConfiguration
public class TacticalRmmConfig {

    @Bean
    public TacticalRmmClient tacticalRmmClient() {
        return new TacticalRmmClient();
    }

}
