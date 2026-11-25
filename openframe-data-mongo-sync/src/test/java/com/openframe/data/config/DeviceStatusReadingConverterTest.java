package com.openframe.data.config;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.core.convert.ConversionFailedException;
import org.springframework.data.mongodb.core.convert.MappingMongoConverter;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;
import org.springframework.data.mongodb.core.convert.NoOpDbRefResolver;
import org.springframework.data.mongodb.core.convert.QueryMapper;
import org.springframework.data.mongodb.core.mapping.MongoMappingContext;
import org.springframework.data.mongodb.core.mapping.MongoPersistentEntity;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.util.Collection;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

class DeviceStatusReadingConverterTest {

    private static final String MACHINE_ID = "machine-1";
    private static final String STATUS = "status";

    private MappingMongoConverter converter;

    @BeforeEach
    void setUp() {
        MongoCustomConversions conversions = new MongoCustomConversionsConfig()
                .mongoCustomConversions(new DefaultListableBeanFactory().getBeanProvider(MongoConversionsContributor.class));
        MongoMappingContext mappingContext = new MongoMappingContext();
        mappingContext.setSimpleTypeHolder(conversions.getSimpleTypeHolder());
        mappingContext.afterPropertiesSet();
        converter = new MappingMongoConverter(NoOpDbRefResolver.INSTANCE, mappingContext);
        converter.setCustomConversions(conversions);
        converter.afterPropertiesSet();
    }

    @ParameterizedTest
    @MethodSource("retiredStatuses")
    void read_storedRetiredStatus_mappedStatus(String stored, DeviceStatus expected) {
        // setup
        Document document = machineDocument(stored);

        // execution
        Machine machine = converter.read(Machine.class, document);

        // verifications
        assertThat(machine)
                .extracting(Machine::getMachineId, Machine::getStatus)
                .containsExactly(MACHINE_ID, expected);
    }

    @ParameterizedTest
    @EnumSource(DeviceStatus.class)
    void read_storedCurrentStatus_sameStatus(DeviceStatus status) {
        // setup
        Document document = machineDocument(status.name());

        // execution
        Machine machine = converter.read(Machine.class, document);

        // verifications
        assertThat(machine.getStatus()).isEqualTo(status);
    }

    @Test
    void read_storedUnknownStatus_throwsConversionFailed() {
        // setup
        Document document = machineDocument("RETIRED");

        // execution
        ConversionFailedException ex = assertThrows(ConversionFailedException.class,
                () -> converter.read(Machine.class, document));

        // verifications
        assertThat(ex.getMessage()).contains("RETIRED");
    }

    @Test
    void read_noStoredStatus_nullStatus() {
        // setup
        Document document = new Document("machineId", MACHINE_ID);

        // execution
        Machine machine = converter.read(Machine.class, document);

        // verifications
        assertThat(machine.getStatus()).isNull();
    }

    @Test
    void write_managed_storedByName() {
        // setup
        Machine machine = new Machine();
        machine.setStatus(DeviceStatus.MANAGED);
        Document document = new Document();

        // execution
        converter.write(machine, document);

        // verifications
        assertThat(document).containsEntry(STATUS, "MANAGED");
    }

    @Test
    void queryMapping_storedNamesGuard_keptAsRawStrings() {
        // setup
        Query guard = Query.query(Criteria.where(STATUS).in(DeviceStatus.storedNames(DeviceStatus.MANAGED)));
        QueryMapper queryMapper = new QueryMapper(converter);
        MongoPersistentEntity<?> entity = converter.getMappingContext().getRequiredPersistentEntity(Machine.class);

        // execution
        Document mapped = queryMapper.getMappedObject(guard.getQueryObject(), entity);

        // verifications
        assertThat(mapped.get(STATUS, Document.class).get("$in", Collection.class))
                .containsExactly("MANAGED", "ACTIVE", "OFFLINE", "ONLINE");
    }

    private static Document machineDocument(String status) {
        return new Document("machineId", MACHINE_ID).append(STATUS, status);
    }

    private static Stream<Arguments> retiredStatuses() {
        return Stream.of(
                Arguments.of("ONLINE", DeviceStatus.MANAGED),
                Arguments.of("OFFLINE", DeviceStatus.MANAGED),
                Arguments.of("ACTIVE", DeviceStatus.MANAGED),
                Arguments.of("INACTIVE", DeviceStatus.ARCHIVED),
                Arguments.of("MAINTENANCE", DeviceStatus.ARCHIVED),
                Arguments.of("DECOMMISSIONED", DeviceStatus.ARCHIVED));
    }
}
