package com.openframe.data.integration.support;

import com.openframe.data.repository.device.CustomMachineRepositoryImpl;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.CustomScriptRepositoryImpl;
import com.openframe.data.repository.rmm.CustomScriptScheduleRepositoryImpl;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.service.rmm.ScheduleDeviceTargetResolver;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

/**
 * Test context for {@link ScheduleDeviceTargetResolver} integration tests. Unlike
 * {@code RmmIntegrationTestApplication}, this also wires the {@code device} repository package so the
 * resolver can query the real {@code machines} collection. Custom repository fragments are imported
 * explicitly (Spring Data resolves them as regular beans), as is the resolver itself (its production
 * home is the tenant app's component scan).
 */
@SpringBootConfiguration
@EnableAutoConfiguration
@EnableMongoAuditing
@EnableMongoRepositories(basePackageClasses = {MachineRepository.class, ScriptRepository.class})
@Import({
        CustomMachineRepositoryImpl.class,
        CustomScriptRepositoryImpl.class,
        CustomScriptScheduleRepositoryImpl.class,
        ScheduleDeviceTargetResolver.class
})
public class ScheduleDeviceResolverIntegrationTestApplication {
}
