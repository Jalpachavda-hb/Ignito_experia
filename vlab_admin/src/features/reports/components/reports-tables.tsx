import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { mockStudentReports, mockCourseReports } from '../data/mock-data'
import { FileText, Users, BookOpen, Layers, Wallet, FlaskConical } from 'lucide-react'

export function ReportsTables() {
  return (
    <Tabs defaultValue="students" className="w-full">
      <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent mb-6 overflow-x-auto">
        <TabsTrigger value="students" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3 whitespace-nowrap">
          <Users className="h-4 w-4 mr-2" />
          Student Reports
        </TabsTrigger>
        <TabsTrigger value="courses" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3 whitespace-nowrap">
          <BookOpen className="h-4 w-4 mr-2" />
          Course Reports
        </TabsTrigger>
        <TabsTrigger value="semesters" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3 whitespace-nowrap">
          <Layers className="h-4 w-4 mr-2" />
          Semester Reports
        </TabsTrigger>
        <TabsTrigger value="credits" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3 whitespace-nowrap">
          <Wallet className="h-4 w-4 mr-2" />
          Credit Reports
        </TabsTrigger>
        <TabsTrigger value="labs" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-6 py-3 whitespace-nowrap">
          <FlaskConical className="h-4 w-4 mr-2" />
          Lab Usage Reports
        </TabsTrigger>
      </TabsList>

      <TabsContent value="students" className="m-0">
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Semester</TableHead>
                  <TableHead className="text-right">Credits Consumed</TableHead>
                  <TableHead className="text-right">Lab Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockStudentReports.slice(0, 10).map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">
                      {student.name}
                      <div className="text-xs text-muted-foreground font-normal">{student.email}</div>
                    </TableCell>
                    <TableCell>{student.course}</TableCell>
                    <TableCell>{student.semester}</TableCell>
                    <TableCell className="text-right text-red-600 dark:text-red-400 font-medium">-{student.creditsUsed}</TableCell>
                    <TableCell className="text-right">{student.labHours} hrs</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="courses" className="m-0">
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Course Code</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead className="text-center">Enrolled Students</TableHead>
                  <TableHead className="text-center">Active Labs</TableHead>
                  <TableHead className="text-right">Total Credit Burn</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockCourseReports.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell className="font-medium">{course.courseName}</TableCell>
                    <TableCell>{course.program}</TableCell>
                    <TableCell className="text-center">{course.totalStudents}</TableCell>
                    <TableCell className="text-center">{course.activeLabs}</TableCell>
                    <TableCell className="text-right text-red-600 dark:text-red-400 font-medium">-{course.totalCreditBurn.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>
      
      {/* Other tabs intentionally left blank for brevity, but UI exists */}
      <TabsContent value="semesters" className="m-0">
        <Card className="border-border/50 shadow-sm p-12 flex flex-col items-center justify-center text-muted-foreground">
          <FileText className="h-8 w-8 mb-4 opacity-50" />
          <p>Semester report generation ready.</p>
        </Card>
      </TabsContent>
      <TabsContent value="credits" className="m-0">
        <Card className="border-border/50 shadow-sm p-12 flex flex-col items-center justify-center text-muted-foreground">
          <Wallet className="h-8 w-8 mb-4 opacity-50" />
          <p>Credit discrepancy report generation ready.</p>
        </Card>
      </TabsContent>
      <TabsContent value="labs" className="m-0">
        <Card className="border-border/50 shadow-sm p-12 flex flex-col items-center justify-center text-muted-foreground">
          <FlaskConical className="h-8 w-8 mb-4 opacity-50" />
          <p>Lab utilization report generation ready.</p>
        </Card>
      </TabsContent>

    </Tabs>
  )
}
