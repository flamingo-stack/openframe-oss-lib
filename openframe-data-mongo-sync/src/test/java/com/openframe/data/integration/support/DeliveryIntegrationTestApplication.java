package com.openframe.data.integration.support;

import com.openframe.data.repository.delivery.MachineDeliveryRepository;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

@SpringBootConfiguration
@EnableAutoConfiguration
@EnableMongoRepositories(basePackageClasses = MachineDeliveryRepository.class)
public class DeliveryIntegrationTestApplication {
}
