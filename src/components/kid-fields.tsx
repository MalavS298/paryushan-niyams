import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AGE_CATEGORIES, PROGRAMS, type AgeCategory, type Program } from "@/lib/niyam";

export type KidDraft = { name: string; age_category: AgeCategory; program: Program };

export const emptyKid = (): KidDraft => ({ name: "", age_category: "6-8", program: "paryushan" });

export function KidFields({
  value,
  onChange,
  idPrefix,
}: {
  value: KidDraft;
  onChange: (next: KidDraft) => void;
  idPrefix: string;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-name`}>Kid's name</Label>
        <Input
          id={`${idPrefix}-name`}
          required
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder="e.g. Malav"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Age category</Label>
          <Select
            value={value.age_category}
            onValueChange={(v) => onChange({ ...value, age_category: v as AgeCategory })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGE_CATEGORIES.map((age) => (
                <SelectItem key={age} value={age}>
                  {age}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Program</Label>
          <Select
            value={value.program}
            onValueChange={(v) => onChange({ ...value, program: v as Program })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PROGRAMS) as Program[]).map((program) => (
                <SelectItem key={program} value={program}>
                  {PROGRAMS[program].label} ({PROGRAMS[program].days} days)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
