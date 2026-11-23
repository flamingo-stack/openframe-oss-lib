package com.openframe.client.service.rmm.osupdate.parser;

import com.openframe.data.document.rmm.osupdate.OsUpdateListConfidence;
import com.openframe.data.nats.rmm.model.MachineOsUpdatesMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

import static org.apache.commons.lang3.StringUtils.isNotBlank;

@Component
@RequiredArgsConstructor
public class ReportedPendingUpdatesParser {

    private final ReportedEnumParser reportedEnumParser;

    // Readable = the device confirms it read its updates and sent the list. An absent list is "could not look",
    // an empty one is "nothing applies".
    public boolean isReadable(MachineOsUpdatesMessage.UpdateSet updates) {
        if (updates == null || updates.getItems() == null) {
            return false;
        }
        OsUpdateListConfidence confidence =
                reportedEnumParser.parse(OsUpdateListConfidence.class, updates.getConfidence());
        return confidence == OsUpdateListConfidence.CONFIRMED;
    }

    public List<MachineOsUpdatesMessage.UpdateItem> parse(MachineOsUpdatesMessage.UpdateSet updates) {
        if (!isReadable(updates)) {
            return List.of();
        }
        return updates.getItems().stream()
                .filter(item -> item != null && isNotBlank(item.getIdentifier()))
                .toList();
    }
}
