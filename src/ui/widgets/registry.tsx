import type { FC } from 'react';
import { Calculators } from '../components/Calculators';
import { Base64Tool, UrlTool, JsonTool, HashTool, CaseTool, CountTool } from './TextTools';
import { UuidTool, PasswordTool, LoremTool } from './GenerateTools';

const UnitWidget: FC = () => <Calculators kind="unit" />;
const TimeWidget: FC = () => <Calculators kind="time" />;

/**
 * Registry of "instant" (non-file) tools — standalone client-side widgets. This is the
 * extension point that makes WebToolsUltima a general tool platform rather than only a file
 * engine: add a component here + a tool entry in `tools/registry.ts` and it appears in the app.
 */
export const WIDGETS: Record<string, FC> = {
  unit: UnitWidget,
  time: TimeWidget,
  base64: Base64Tool,
  url: UrlTool,
  json: JsonTool,
  hash: HashTool,
  case: CaseTool,
  count: CountTool,
  uuid: UuidTool,
  password: PasswordTool,
  lorem: LoremTool,
};
