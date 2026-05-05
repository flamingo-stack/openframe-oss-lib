package com.openframe.data.audit;

import com.openframe.data.document.clientconfiguration.PublishState;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.mapping.event.AbstractMongoEventListener;
import org.springframework.data.mongodb.core.mapping.event.AfterSaveEvent;
import org.springframework.data.mongodb.core.mapping.event.BeforeSaveEvent;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class IntegratedToolAgentChangeLogger extends AbstractMongoEventListener<IntegratedToolAgent> {

    @Override
    public void onBeforeSave(BeforeSaveEvent<IntegratedToolAgent> event) {
        IntegratedToolAgent agent = event.getSource();
        log("before", agent);
    }

    @Override
    public void onAfterSave(AfterSaveEvent<IntegratedToolAgent> event) {
        IntegratedToolAgent agent = event.getSource();
        log("after", agent);
    }

    private void log(String phase, IntegratedToolAgent agent) {
        String id = agent.getId();
        Long documentVersion = agent.getDocumentVersion();
        String version = agent.getVersion();
        boolean releaseVersion = agent.isReleaseVersion();
        PublishState publishState = agent.getPublishState();
        String publishStateFormatted = formatPublishState(publishState);
        log.info("save-{} id={} v={} agentVersion={} release={} publish={}",
                phase, id, documentVersion, version, releaseVersion, publishStateFormatted);
    }

    private static String formatPublishState(PublishState ps) {
        if (ps == null) {
            return "none";
        }
        boolean published = ps.isPublished();
        if (published) {
            return "published";
        }
        int attempts = ps.getAttempts();
        return attempts == 0
                ? "pending"
                : "pending(attempts=" + attempts + ")";
    }
}
