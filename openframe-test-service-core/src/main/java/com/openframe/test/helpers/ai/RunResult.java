package com.openframe.test.helpers.ai;

import com.openframe.test.data.dto.ai.Message;
import com.openframe.test.data.dto.ai.MessageData;
import com.openframe.test.data.dto.ai.MessageDataType;
import com.openframe.test.data.dto.ai.MessageOwnerType;
import com.openframe.test.data.dto.ai.PendingToolCall;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * The conversation after a run reached a terminal state. The assistant's own text and tool reports are
 * <em>diagnostic signals only</em> — never the reason a device test passes. {@link #toString()} dumps
 * the whole conversation; that dump is what an engineer reads when a nightly run fails.
 */
public class RunResult {

    private final List<Message> messages;

    public RunResult(List<Message> messages) {
        this.messages = messages == null ? List.of() : messages;
    }

    public List<Message> rawMessages() {
        return messages;
    }

    /** Concatenated text of the last ASSISTANT message, or {@code null} if there is none. */
    public String finalText() {
        for (int i = messages.size() - 1; i >= 0; i--) {
            Message m = messages.get(i);
            if (isAssistant(m)) {
                String text = dataOfType(m, MessageDataType.TEXT).stream()
                        .map(MessageData::getText)
                        .filter(t -> t != null && !t.isBlank())
                        .collect(Collectors.joining("\n"));
                if (!text.isBlank()) {
                    return text;
                }
            }
        }
        return null;
    }

    public List<MessageData> executedTools() {
        return allData(MessageDataType.EXECUTED_TOOL);
    }

    public List<MessageData> approvalRequests() {
        return allData(MessageDataType.APPROVAL_REQUEST);
    }

    public List<MessageData> errors() {
        return allData(MessageDataType.ERROR);
    }

    /**
     * Every command the assistant asked permission to run, as text.
     * <p>
     * Reads both places it can live: {@code ApprovalRequestData.command}, and each pending tool call's
     * arguments. The top-level field is null on every request observed on the client surface, so a check
     * that consults only it silently matches nothing — which is worse than no check at all, since it looks
     * like a passing assertion.
     */
    public List<String> requestedCommands() {
        List<String> out = new ArrayList<>();
        for (MessageData d : approvalRequests()) {
            if (d.getCommand() != null) {
                out.add(d.getCommand());
            }
            if (d.getToolCalls() != null) {
                d.getToolCalls().stream()
                        .map(PendingToolCall::getToolCallArguments)
                        .filter(args -> args != null)
                        .map(String::valueOf)
                        .forEach(out::add);
            }
        }
        return out;
    }

    /** True if any executed tool reported {@code success == true}. Diagnostic only. */
    public boolean anyExecutedToolSucceeded() {
        return executedTools().stream().anyMatch(d -> Boolean.TRUE.equals(d.getSuccess()));
    }

    private boolean isAssistant(Message m) {
        return m.getOwner() != null && m.getOwner().getType() == MessageOwnerType.ASSISTANT;
    }

    private List<MessageData> allData(MessageDataType type) {
        List<MessageData> out = new ArrayList<>();
        for (Message m : messages) {
            out.addAll(dataOfType(m, type));
        }
        return out;
    }

    private List<MessageData> dataOfType(Message m, MessageDataType type) {
        if (m.getMessageData() == null) {
            return List.of();
        }
        return m.getMessageData().stream()
                .filter(d -> d.getType() == type)
                .collect(Collectors.toList());
    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder("RunResult conversation dump:\n");
        for (Message m : messages) {
            String owner = m.getOwner() == null ? "?" : String.valueOf(m.getOwner().getType());
            sb.append("  [").append(owner).append(" @ ").append(m.getCreatedAt()).append("]\n");
            if (m.getMessageData() != null) {
                for (MessageData d : m.getMessageData()) {
                    sb.append("      ").append(d.getType()).append(": ");
                    if (d.getText() != null) sb.append("text=").append(trim(d.getText()));
                    if (d.getToolFunction() != null) sb.append("tool=").append(d.getToolFunction())
                            .append(" success=").append(d.getSuccess())
                            .append(" result=").append(trim(d.getResult()));
                    if (d.getCommand() != null) sb.append("command=").append(trim(d.getCommand()));
                    if (d.getApprovalRequestId() != null) sb.append(" approvalRequestId=").append(d.getApprovalRequestId())
                            .append(" approvalType=").append(d.getApprovalType());
                    if (d.getError() != null) sb.append("error=").append(trim(d.getError()))
                            .append(" details=").append(trim(d.getDetails()));
                    sb.append('\n');
                }
            }
        }
        return sb.toString();
    }

    private static String trim(String s) {
        if (s == null) return "null";
        String flat = s.replaceAll("\\s+", " ").trim();
        return flat.length() > 300 ? flat.substring(0, 300) + "…" : flat;
    }
}
