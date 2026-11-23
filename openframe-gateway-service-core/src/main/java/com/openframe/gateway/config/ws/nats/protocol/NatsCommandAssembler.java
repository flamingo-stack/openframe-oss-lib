package com.openframe.gateway.config.ws.nats.protocol;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Turns the websocket frames of one client into complete {@link NatsClientCommand}s.
 * <p>
 * The websocket is a byte stream to NATS: a frame may carry several commands and a command may
 * continue in the next frame, so this is the one stateful piece per session. It only does framing:
 * a control line is held back until its line end arrives, a {@code PUB}/{@code HPUB} payload until
 * its last byte, and the complete command goes out as one unit for the checks to judge. A line NATS
 * could not parse comes out {@link NatsClientCommand#malformed malformed}, never as an exception,
 * so the session decides whether to end or to {@link #relayUnparsed() stop parsing}.
 */
public final class NatsCommandAssembler {

    /** NATS's default {@code max_control_line}; the tenant configmap does not raise it. */
    static final int MAX_CONTROL_LINE_BYTES = 4096;

    private static final byte LINE_END = '\n';
    private static final int PAYLOAD_TRAILER_BYTES = 2;

    private final NatsControlLineParser controlLineParser;
    private final long maxPayloadBytes;

    private final ByteArrayOutputStream pendingLine = new ByteArrayOutputStream();
    private final ByteArrayOutputStream pendingPayload = new ByteArrayOutputStream();
    private NatsControlLine pendingControlLine;
    private long payloadRemaining;
    private boolean unparsed;

    public NatsCommandAssembler(NatsControlLineParser controlLineParser, long maxPayloadBytes) {
        this.controlLineParser = controlLineParser;
        this.maxPayloadBytes = maxPayloadBytes;
    }

    /** From here on every frame is relayed as one unparsed command, state included. */
    public void relayUnparsed() {
        unparsed = true;
    }

    public List<NatsClientCommand> feed(byte[] frame) {
        if (unparsed) {
            return List.of(NatsClientCommand.unparsed(frame));
        }
        List<NatsClientCommand> commands = new ArrayList<>();
        int position = 0;
        while (position < frame.length) {
            if (isInsidePayload()) {
                position = consumePayload(frame, position, commands);
            } else {
                position = consumeControlLine(frame, position, commands);
            }
        }
        return commands;
    }

    private boolean isInsidePayload() {
        return payloadRemaining > 0;
    }

    private int consumePayload(byte[] frame, int position, List<NatsClientCommand> commands) {
        int available = frame.length - position;
        int count = (int) Math.min(payloadRemaining, available);
        pendingPayload.write(frame, position, count);
        payloadRemaining -= count;
        if (!isInsidePayload()) {
            commands.add(completePublish());
        }
        return position + count;
    }

    private NatsClientCommand completePublish() {
        byte[] payloadWithTrailer = pendingPayload.toByteArray();
        pendingPayload.reset();
        NatsControlLine controlLine = pendingControlLine;
        pendingControlLine = null;
        byte[] raw = concat(controlLine.raw(), payloadWithTrailer);
        byte[] payload = withoutTrailer(payloadWithTrailer);
        return NatsClientCommand.parsed(controlLine, payload, raw);
    }

    private int consumeControlLine(byte[] frame, int position, List<NatsClientCommand> commands) {
        int lineEnd = indexOfLineEnd(frame, position);
        if (lineEnd < 0) {
            pendingLine.write(frame, position, frame.length - position);
            guardControlLineLength(commands);
            return frame.length;
        }
        pendingLine.write(frame, position, lineEnd - position + 1);
        byte[] line = takePendingLine();
        acceptLine(line, commands);
        return lineEnd + 1;
    }

    /** A publish line is complete only with its payload, so it is held until the payload's last byte. */
    private void acceptLine(byte[] line, List<NatsClientCommand> commands) {
        NatsControlLine controlLine;
        try {
            controlLine = controlLineParser.parse(line);
        } catch (NatsProtocolException e) {
            commands.add(NatsClientCommand.malformed(line, e.getMessage()));
            return;
        }
        if (controlLine.payloadSize() > maxPayloadBytes) {
            commands.add(NatsClientCommand.malformed(line, "payload larger than " + maxPayloadBytes + " bytes"));
            return;
        }
        if (controlLine.operation().isPublish()) {
            pendingControlLine = controlLine;
            payloadRemaining = controlLine.payloadSize() + PAYLOAD_TRAILER_BYTES;
            return;
        }
        commands.add(NatsClientCommand.parsed(controlLine, new byte[0], line));
    }

    private void guardControlLineLength(List<NatsClientCommand> commands) {
        if (pendingLine.size() <= MAX_CONTROL_LINE_BYTES) {
            return;
        }
        byte[] held = takePendingLine();
        commands.add(NatsClientCommand.malformed(held, "control line longer than " + MAX_CONTROL_LINE_BYTES + " bytes"));
        unparsed = true;
    }

    private byte[] takePendingLine() {
        byte[] line = pendingLine.toByteArray();
        pendingLine.reset();
        return line;
    }

    private static byte[] withoutTrailer(byte[] payloadWithTrailer) {
        int length = Math.max(0, payloadWithTrailer.length - PAYLOAD_TRAILER_BYTES);
        byte[] payload = new byte[length];
        System.arraycopy(payloadWithTrailer, 0, payload, 0, length);
        return payload;
    }

    private static byte[] concat(byte[] head, byte[] tail) {
        byte[] joined = new byte[head.length + tail.length];
        System.arraycopy(head, 0, joined, 0, head.length);
        System.arraycopy(tail, 0, joined, head.length, tail.length);
        return joined;
    }

    private static int indexOfLineEnd(byte[] frame, int from) {
        for (int i = from; i < frame.length; i++) {
            if (frame[i] == LINE_END) {
                return i;
            }
        }
        return -1;
    }
}
