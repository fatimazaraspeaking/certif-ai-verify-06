
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, ClockIcon, FileCheck, BookOpen, BookText } from "lucide-react";

const API_BASE_URL = "https://certificate-verification-worker.your-domain.workers.dev";

interface VerificationResult {
  success: boolean;
  status: "pending" | "verified" | "rejected";
  message: string;
  details?: {
    document_a: {
      student_name: string | null;
      institution_name: string | null;
      degree_or_program: string | null;
      date_of_issue: string | null;
      certificate_title: string | null;
    };
    verification_url_valid: boolean;
    total_verification: "pass" | "fail";
  };
  requestId?: string;
  timestamp: string;
}

const Index = () => {
  const [userId, setUserId] = useState("");
  const [certificateId, setCertificateId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("verify");

  const handleVerify = async () => {
    if (!userId || !certificateId) {
      setError("Please provide both User ID and Certificate ID");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/verify/${userId}/${certificateId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Verification request failed");
      }

      setResult(data);
    } catch (err) {
      setError(err.message || "An error occurred during verification");
    } finally {
      setLoading(false);
    }
  };

  const handleViewLogs = async (requestId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/logs/${requestId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to retrieve logs");
      }

      // In a real app, we'd display logs here
      console.log("Logs:", data);
      // For simplicity in this demo, we'll just switch to the logs tab
      setActiveTab("logs");
    } catch (err) {
      setError(err.message || "An error occurred while retrieving logs");
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "verified":
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case "rejected":
        return <AlertCircle className="h-6 w-6 text-red-500" />;
      case "pending":
      default:
        return <ClockIcon className="h-6 w-6 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Verified</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-200">Rejected</Badge>;
      case "pending":
      default:
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Pending</Badge>;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold">Certificate Verification System</h1>
        <p className="text-gray-600 mt-2">Verify the authenticity of educational certificates using AI</p>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="max-w-3xl mx-auto">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="verify">Verify Certificate</TabsTrigger>
          <TabsTrigger value="logs">System Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="verify">
          <Card>
            <CardHeader>
              <CardTitle>Certificate Verification</CardTitle>
              <CardDescription>
                Enter the User ID and Certificate ID to verify a certificate's authenticity
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="userId">User ID</Label>
                <Input
                  id="userId"
                  placeholder="Enter user ID"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="certificateId">Certificate ID</Label>
                <Input
                  id="certificateId"
                  placeholder="Enter certificate ID"
                  value={certificateId}
                  onChange={(e) => setCertificateId(e.target.value)}
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {result && (
                <div className="rounded-lg border p-4 mt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(result.status)}
                      <h3 className="font-semibold text-lg">Verification {result.status}</h3>
                    </div>
                    {getStatusBadge(result.status)}
                  </div>
                  
                  <p className="text-gray-600 mt-2">{result.message}</p>
                  
                  {result.details && (
                    <div className="mt-4 space-y-3">
                      <h4 className="font-medium">Certificate Details:</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-gray-500" /> 
                          <span className="font-medium">Student Name:</span>
                        </div>
                        <div>{result.details.document_a.student_name || "N/A"}</div>
                        
                        <div className="flex items-center gap-2">
                          <BookText className="h-4 w-4 text-gray-500" /> 
                          <span className="font-medium">Institution:</span>
                        </div>
                        <div>{result.details.document_a.institution_name || "N/A"}</div>
                        
                        <div className="flex items-center gap-2">
                          <FileCheck className="h-4 w-4 text-gray-500" /> 
                          <span className="font-medium">Degree/Program:</span>
                        </div>
                        <div>{result.details.document_a.degree_or_program || "N/A"}</div>
                      </div>
                    </div>
                  )}
                  
                  {result.requestId && (
                    <div className="mt-4 text-sm text-gray-500">
                      <p>Request ID: {result.requestId}</p>
                      <p>Timestamp: {new Date(result.timestamp).toLocaleString()}</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2"
                        onClick={() => handleViewLogs(result.requestId!)}
                      >
                        View Logs
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full" 
                onClick={handleVerify} 
                disabled={loading}
              >
                {loading ? "Verifying..." : "Verify Certificate"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Verification Logs</CardTitle>
              <CardDescription>
                View system logs for certificate verification processes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-8 text-center text-gray-500">
                <p>When you verify a certificate, detailed logs will be available here.</p>
                <p className="mt-2">Use the "View Logs" button after verification to see detailed process logs.</p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setActiveTab("verify")}>
                Back to Verification
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Index;
