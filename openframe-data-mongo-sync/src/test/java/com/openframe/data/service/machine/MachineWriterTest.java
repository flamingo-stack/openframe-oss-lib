package com.openframe.data.service.machine;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.DirectorySource;
import com.openframe.data.document.device.DirectoryUserLink;
import com.openframe.data.document.device.Machine;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static com.openframe.data.service.machine.MachineFields.COMPUTER_NAME;
import static com.openframe.data.service.machine.MachineFields.DIRECTORY_SOURCES;
import static com.openframe.data.service.machine.MachineFields.DIRECTORY_USER_IDS;
import static com.openframe.data.service.machine.MachineFields.DIRECTORY_USER_LINK;
import static com.openframe.data.service.machine.MachineFields.DIRECTORY_USER_NAME;
import static com.openframe.data.service.machine.MachineFields.LAST_SEEN;
import static com.openframe.data.service.machine.MachineFields.MANUFACTURER;
import static com.openframe.data.service.machine.MachineFields.MODEL;
import static com.openframe.data.service.machine.MachineFields.NICKNAME;
import static com.openframe.data.service.machine.MachineFields.OS_UUID;
import static com.openframe.data.service.machine.MachineFields.SERIAL_NUMBER;
import static com.openframe.data.service.machine.MachineFields.STATUS;
import static com.openframe.data.service.machine.MachineUpdate.machineUpdate;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class MachineWriterTest {

    private MongoTemplate template;
    private MachineWriter writer;

    @BeforeEach
    void setUp() {
        template = mock(MongoTemplate.class);
        writer = new MachineWriter(template);
    }

    private void storedDocumentIs(Machine machine) {
        when(template.findAndModify(any(Query.class), any(Update.class),
                any(FindAndModifyOptions.class), eq(Machine.class))).thenReturn(machine);
    }

    private Update capturedUpdate() {
        ArgumentCaptor<Update> captor = ArgumentCaptor.forClass(Update.class);
        verify(template).findAndModify(any(Query.class), captor.capture(),
                any(FindAndModifyOptions.class), eq(Machine.class));
        return captor.getValue();
    }

    private Query capturedQuery() {
        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        verify(template).findAndModify(captor.capture(), any(Update.class),
                any(FindAndModifyOptions.class), eq(Machine.class));
        return captor.getValue();
    }

    private static Document setClause(Update update) {
        return (Document) update.getUpdateObject().get("$set");
    }

    @Test
    @DisplayName("writes only the named fields plus updatedAt — never a whole-document save")
    void writesOnlyNamedFields() {
        Machine stored = new Machine();
        stored.setMachineId("m1");
        storedDocumentIs(stored);

        writer.update("m1", machineUpdate().set(NICKNAME, "Reception iMac"));

        Document set = setClause(capturedUpdate());
        assertThat(set).containsOnlyKeys("nickname", "updatedAt");
        assertThat(set.get("nickname")).isEqualTo("Reception iMac");
        verify(template, never()).save(any());
    }

    @Test
    @DisplayName("maintains updatedAt itself — @LastModifiedDate auditing does not run on findAndModify")
    void setsUpdatedAt() {
        Machine stored = new Machine();
        stored.setUpdatedAt(Instant.parse("2020-01-01T00:00:00Z"));
        storedDocumentIs(stored);

        Optional<MachineWriteResult> result = writer.update("m1", machineUpdate().set(NICKNAME, "x"));

        Object written = setClause(capturedUpdate()).get("updatedAt");
        assertThat(written).isInstanceOf(Instant.class);
        assertThat((Instant) written).isAfter(Instant.parse("2020-01-01T00:00:00Z"));
        assertThat(result.orElseThrow().after().getUpdatedAt()).isEqualTo(written);
    }

    @Test
    @DisplayName("null value clears the field via an explicit $set rather than being skipped")
    void nullClearsField() {
        storedDocumentIs(new Machine());

        writer.update("m1", machineUpdate().set(NICKNAME, null));

        assertThat(setClause(capturedUpdate())).containsEntry("nickname", null);
    }

    @Test
    @DisplayName("returns both images from one round trip: before is untouched, after carries the change")
    void returnsBeforeAndAfter() {
        Machine stored = new Machine();
        stored.setMachineId("m1");
        stored.setNickname("Old");
        stored.setStatus(DeviceStatus.OFFLINE);
        storedDocumentIs(stored);

        MachineWriteResult result = writer
                .update("m1", machineUpdate().set(NICKNAME, "New").set(STATUS, DeviceStatus.ONLINE))
                .orElseThrow();

        assertThat(result.before().getNickname()).isEqualTo("Old");
        assertThat(result.before().getStatus()).isEqualTo(DeviceStatus.OFFLINE);
        assertThat(result.after().getNickname()).isEqualTo("New");
        assertThat(result.after().getStatus()).isEqualTo(DeviceStatus.ONLINE);
        assertThat(result.after().getMachineId()).isEqualTo("m1");
        assertThat(result.before()).isNotSameAs(result.after());
        // One findAndModify, no follow-up read to obtain the post-image.
        verify(template, never()).findOne(any(Query.class), eq(Machine.class));
    }

    @Test
    @DisplayName("no match → empty result, so nothing downstream treats it as a change")
    void noMatchReturnsEmpty() {
        storedDocumentIs(null);

        Optional<MachineWriteResult> result = writer.update("gone", machineUpdate().set(NICKNAME, "x"));

        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("guard criteria is ANDed into the atomic write, so staleness cannot be checked-then-lost")
    void guardIsPartOfTheWrite() {
        storedDocumentIs(new Machine());
        Instant eventTime = Instant.parse("2026-01-01T00:00:00Z");

        writer.update("m1",
                Criteria.where("lastSeen").lt(eventTime),
                machineUpdate().set(STATUS, DeviceStatus.ONLINE).set(LAST_SEEN, eventTime));

        Document query = capturedQuery().getQueryObject();
        @SuppressWarnings("unchecked")
        List<Document> and = (List<Document>) query.get("$and");
        assertThat(and).as("identity and guard share one atomic query").hasSize(2);
        assertThat(and).anySatisfy(clause -> assertThat(clause).containsEntry("machineId", "m1"));
        assertThat(and).anySatisfy(clause -> assertThat(clause).containsKey("lastSeen"));
    }

    @Test
    @DisplayName("empty update is a no-op: no write at all")
    void emptyUpdateDoesNothing() {
        assertThat(writer.update("m1", machineUpdate())).isEmpty();

        verifyNoInteractions(template);
    }

    @Test
    @DisplayName("hardware facts and the directory summary are writable fields: each lands in $set under its own path and on the after image")
    void writesHardwareAndDirectoryFields() {
        storedDocumentIs(new Machine());

        MachineWriteResult result = writer.update("m1", machineUpdate()
                        .set(SERIAL_NUMBER, "C02XG2JHJG5H")
                        .set(MODEL, "MacBookPro18,3")
                        .set(MANUFACTURER, "Apple Inc.")
                        .set(OS_UUID, "6F1A2B3C-0000-4D5E-8F90-123456789ABC")
                        .set(COMPUTER_NAME, "Jane's MacBook Pro")
                        .set(DIRECTORY_SOURCES, List.of(DirectorySource.MICROSOFT_365))
                        .set(DIRECTORY_USER_LINK, DirectoryUserLink.PRIMARY)
                        .set(DIRECTORY_USER_IDS, List.of("acc-1"))
                        .set(DIRECTORY_USER_NAME, "Jane Doe"))
                .orElseThrow();

        assertThat(setClause(capturedUpdate())).containsOnlyKeys("serialNumber", "model", "manufacturer", "osUuid",
                "computerName", "directorySources", "directoryUserLink", "directoryUserIds", "directoryUserName",
                "updatedAt");
        Machine after = result.after();
        assertThat(after).extracting(Machine::getSerialNumber, Machine::getModel, Machine::getManufacturer,
                        Machine::getOsUuid, Machine::getComputerName)
                .containsExactly("C02XG2JHJG5H", "MacBookPro18,3", "Apple Inc.",
                        "6F1A2B3C-0000-4D5E-8F90-123456789ABC", "Jane's MacBook Pro");
        assertThat(after).extracting(Machine::getDirectorySources, Machine::getDirectoryUserLink,
                        Machine::getDirectoryUserIds, Machine::getDirectoryUserName)
                .containsExactly(List.of(DirectorySource.MICROSOFT_365), DirectoryUserLink.PRIMARY,
                        List.of("acc-1"), "Jane Doe");
    }

    @Test
    @DisplayName("clearing the directory summary writes explicit nulls, so a machine whose links went away reads as NONE again")
    void clearsDirectoryFields() {
        storedDocumentIs(new Machine());

        writer.update("m1", machineUpdate()
                .set(DIRECTORY_SOURCES, null)
                .set(DIRECTORY_USER_LINK, null)
                .set(DIRECTORY_USER_IDS, null)
                .set(DIRECTORY_USER_NAME, null));

        assertThat(setClause(capturedUpdate()))
                .containsEntry("directorySources", null)
                .containsEntry("directoryUserLink", null)
                .containsEntry("directoryUserIds", null)
                .containsEntry("directoryUserName", null);
    }
}
