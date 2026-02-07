import { formatDate, formatGender } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PatientData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  bloodType: string | null;
  allergies: unknown;
  activeConditions: unknown;
  notes: string | null;
  createdAt: Date;
}

interface PatientSummaryProps {
  patient: PatientData;
}

type Allergy = {
  name: string;
  severity: string;
  reaction?: string;
};

export function PatientSummary({ patient }: PatientSummaryProps) {
  const allergies = (patient.allergies ?? []) as Allergy[];
  const conditions = (patient.activeConditions ?? []) as string[];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Demographics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow label="Full Name">
            {patient.firstName} {patient.lastName}
          </InfoRow>
          <InfoRow label="Date of Birth">
            {formatDate(patient.dateOfBirth)}
          </InfoRow>
          <InfoRow label="Gender">{formatGender(patient.gender)}</InfoRow>
          <InfoRow label="Blood Type">
            {patient.bloodType ?? "Not recorded"}
          </InfoRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow label="Email">{patient.email ?? "Not provided"}</InfoRow>
          <InfoRow label="Phone">{patient.phone ?? "Not provided"}</InfoRow>
          <InfoRow label="Address">{patient.address ?? "Not provided"}</InfoRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Emergency Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow label="Name">
            {patient.emergencyContactName ?? "Not provided"}
          </InfoRow>
          <InfoRow label="Phone">
            {patient.emergencyContactPhone ?? "Not provided"}
          </InfoRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Allergies ({allergies.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {allergies.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No known allergies recorded
            </p>
          ) : (
            <div className="space-y-2">
              {allergies.map((allergy) => (
                <div
                  key={allergy.name}
                  className="flex items-center justify-between"
                >
                  <div>
                    <span className="text-sm font-medium">{allergy.name}</span>
                    {allergy.reaction && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        — {allergy.reaction}
                      </span>
                    )}
                  </div>
                  <Badge
                    variant={
                      allergy.severity === "severe"
                        ? "destructive"
                        : allergy.severity === "moderate"
                          ? "warning"
                          : "secondary"
                    }
                  >
                    {allergy.severity}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Active Conditions ({conditions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {conditions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active conditions recorded
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {conditions.map((condition) => (
                <Badge key={condition} variant="outline">
                  {condition}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {patient.notes && (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{patient.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}
