package com.openframe.data.integration.support;

import com.openframe.data.repository.device.CustomMachineRepositoryImpl;
import com.openframe.data.repository.device.MachineRepository;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

/**
 * Minimal Spring Boot configuration for Machine repository integration tests.
 * Repository scanning is restricted to the device package so unrelated
 * repositories do not need wiring.
 *
 * <p>Mongo auditing is intentionally NOT enabled: {@code updatedAt} carries
 * {@code @LastModifiedDate}, and these tests assert that a targeted update
 * leaves every other field byte-for-byte intact.
 *
 * <p>The custom repository fragment implementation is not picked up by
 * {@code @EnableMongoRepositories} alone, so it is imported explicitly.
 */
@SpringBootConfiguration
@EnableAutoConfiguration
@EnableMongoRepositories(basePackageClasses = MachineRepository.class)
@Import({
        CustomMachineRepositoryImpl.class
})
public class MachineIntegrationTestApplication {
}
