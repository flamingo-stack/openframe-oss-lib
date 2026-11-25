package com.openframe.client.service.rmm.osupdate.parser;

import com.openframe.client.metrics.DeviceOsReportMetrics;
import com.openframe.data.nats.rmm.model.MachineOsUpdatesMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.List;

import static org.mockito.Mockito.mock;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

@ExtendWith(MockitoExtension.class)
class ReportedPendingUpdatesParserTest {

    @Spy private ReportedEnumParser reportedEnumParser = new ReportedEnumParser(mock(DeviceOsReportMetrics.class));

    @InjectMocks private ReportedPendingUpdatesParser parser;

    private MachineOsUpdatesMessage.UpdateSet updates;

    @BeforeEach
    void setUp() {
        updates = new MachineOsUpdatesMessage.UpdateSet();
        updates.setConfidence("CONFIRMED");
        updates.setItems(List.of(item("Safari-18.2")));
    }

    @Test
    void isReadable_confirmedListWithItems_true() {
        // setup

        // execution
        boolean readable = parser.isReadable(updates);

        // verifications
        assertThat(readable).isTrue();
    }

    @Test
    void isReadable_confirmedEmptyList_true() {
        // setup
        updates.setItems(List.of());

        // execution
        boolean readable = parser.isReadable(updates);

        // verifications
        assertThat(readable).isTrue();
    }

    @Test
    void isReadable_confirmedButNoList_false() {
        // setup
        updates.setItems(null);

        // execution
        boolean readable = parser.isReadable(updates);

        // verifications
        assertThat(readable).isFalse();
    }

    @Test
    void isReadable_noUpdatesBlock_false() {
        // setup

        // execution
        boolean readable = parser.isReadable(null);

        // verifications
        assertThat(readable).isFalse();
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "UNCONFIRMED", "RETAINED", "UNREADABLE", "TOO_LARGE", "SOMETHING_NEW"})
    void isReadable_listWithAnyOtherConfidence_false(String confidence) {
        // setup
        updates.setConfidence(confidence);

        // execution
        boolean readable = parser.isReadable(updates);

        // verifications
        assertThat(readable).isFalse();
    }

    @Test
    void parse_readableList_itemsWithAnIdentifierReturnedInTheReportedOrder() {
        // setup
        MachineOsUpdatesMessage.UpdateItem first = item("Safari-18.2");
        MachineOsUpdatesMessage.UpdateItem second = item("MSU_UPDATE_25C56_patch_26.2");
        updates.setItems(Arrays.asList(first, null, item(null), item(" "), second));

        // execution
        List<MachineOsUpdatesMessage.UpdateItem> items = parser.parse(updates);

        // verifications
        assertThat(items).containsExactly(first, second);
    }

    @Test
    void parse_confirmedEmptyList_noItems() {
        // setup
        updates.setItems(List.of());

        // execution
        List<MachineOsUpdatesMessage.UpdateItem> items = parser.parse(updates);

        // verifications
        assertThat(items).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {"UNCONFIRMED", "RETAINED", "UNREADABLE", "TOO_LARGE"})
    void parse_listThatIsNotConfirmed_noItemsEvenWhenTheDeviceSentSome(String confidence) {
        // setup
        updates.setConfidence(confidence);

        // execution
        List<MachineOsUpdatesMessage.UpdateItem> items = parser.parse(updates);

        // verifications
        assertThat(items).isEmpty();
    }

    @Test
    void parse_noUpdatesBlock_noItems() {
        // setup

        // execution
        List<MachineOsUpdatesMessage.UpdateItem> items = parser.parse(null);

        // verifications
        assertThat(items).isEmpty();
    }

    @Test
    void parse_sameIdentifierNamedTwice_oneItemPerIdentifierTheFirstOneInTheOrderOfTheReport() {
        // setup
        MachineOsUpdatesMessage.UpdateItem first = item("Safari-18.2");
        first.setDisplayName("Named first");
        MachineOsUpdatesMessage.UpdateItem again = item("Safari-18.2");
        again.setDisplayName("Named again");
        MachineOsUpdatesMessage.UpdateItem other = item("Pages-15.1");
        other.setDisplayName("Another update");
        updates.setItems(List.of(first, other, again));

        // execution
        List<MachineOsUpdatesMessage.UpdateItem> items = parser.parse(updates);

        // verifications
        assertThat(items)
                .extracting(MachineOsUpdatesMessage.UpdateItem::getIdentifier,
                        MachineOsUpdatesMessage.UpdateItem::getDisplayName)
                .containsExactly(tuple("Safari-18.2", "Named first"), tuple("Pages-15.1", "Another update"));
    }

    private static MachineOsUpdatesMessage.UpdateItem item(String identifier) {
        MachineOsUpdatesMessage.UpdateItem item = new MachineOsUpdatesMessage.UpdateItem();
        item.setIdentifier(identifier);
        return item;
    }
}
