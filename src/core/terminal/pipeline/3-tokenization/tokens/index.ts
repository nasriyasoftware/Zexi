import { AnsiToken } from "./rendering/ansi.token";
import { SoftWrapToken } from "./rendering/soft.wrap.token";
import { StackTraceToken } from "./rendering/stack.trace.token";
import { DateToken } from "./tokenization/date.token";
import { ErrorStartToken, ErrorDataToken, ErrorCauseStartToken, ErrorCauseEndToken, ErrorEndToken } from "./tokenization/error";
import { FunctionToken } from "./tokenization/function.token";
import { GroupStartToken, GroupEndToken } from "./tokenization/group";
import { CallbackToken } from "./tokenization/callback.token";
import { IndentStart, IndentEnd } from "./tokenization/indent";
import { KeyValueSeparatorToken } from "./tokenization/key-value.separator";
import { SoftLineToken, HardLineToken } from "./tokenization/line";
import { ObjectNameToken, ObjectOpenToken, ObjectCloseToken } from "./tokenization/object";
import { PrimitiveToken } from "./tokenization/primitive.token";
import { PropertyToken } from "./tokenization/property.token";
import { ReferenceStartToken, ReferenceEndToken } from "./tokenization/reference";
import { RegExpToken } from "./tokenization/regex.token";
import { SeparatorToken } from "./tokenization/separator.token";
import { SoftSpaceToken, HardSpaceToken } from "./tokenization/space";
import { AnchorToken } from "./rendering/anchor.token";

const TOKENS = {
    Ansi: AnsiToken,
    SoftWrap: SoftWrapToken,
    StackTrace: StackTraceToken,

    GroupStart: GroupStartToken,
    GroupEnd: GroupEndToken,

    IndentStart: IndentStart,
    IndentEnd: IndentEnd,

    HardLine: HardLineToken,
    SoftLine: SoftLineToken,

    ObjectName: ObjectNameToken,
    ObjectOpen: ObjectOpenToken,
    ObjectClose: ObjectCloseToken,

    ReferenceStart: ReferenceStartToken,
    ReferenceEnd: ReferenceEndToken,

    HardSpace: HardSpaceToken,
    SoftSpace: SoftSpaceToken,

    ErrorStart: ErrorStartToken,
    ErrorData: ErrorDataToken,
    ErrorCauseStart: ErrorCauseStartToken,
    ErrorCauseEnd: ErrorCauseEndToken,
    ErrorEnd: ErrorEndToken,

    Callback: CallbackToken,
    Date: DateToken,
    Function: FunctionToken,
    KeyValueSeparator: KeyValueSeparatorToken,
    Primitive: PrimitiveToken,
    Property: PropertyToken,
    RegExp: RegExpToken,
    Separator: SeparatorToken,
    Anchor: AnchorToken
} as const;

export default TOKENS;