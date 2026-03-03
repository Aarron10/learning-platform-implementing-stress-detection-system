import io
import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.units import inch

def generate_session_pdf(analytics, session_id):
    """
    Generates a PDF report for a study session and returns it as a bytes object.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=18)
    
    styles = getSampleStyleSheet()
    
    # Custom Styles
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor("#1976D2"),
        spaceAfter=12
    )
    
    subtitle_style = ParagraphStyle(
        'SubtitleStyle',
        parent=styles['Normal'],
        fontSize=12,
        textColor=colors.gray,
        spaceAfter=24
    )
    
    stat_label_style = ParagraphStyle(
        'StatLabel',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.darkgray
    )
    
    stat_val_style = ParagraphStyle(
        'StatValue',
        parent=styles['Normal'],
        fontSize=18,
        fontWeight='bold',
        textColor=colors.black
    )
    
    story = []
    
    # 1. Header
    story.append(Paragraph(f"Focus Performance Report", title_style))
    story.append(Paragraph(f"Session Identification: #{session_id}", subtitle_style))
    story.append(Spacer(1, 0.2 * inch))
    
    # 2. Executive Summary Table
    data = [
        [Paragraph("Average Focus", stat_label_style), Paragraph("Average Stress", stat_label_style)],
        [Paragraph(f"{round(analytics['avg_focus'] * 100)}%", stat_val_style), Paragraph(f"{round(analytics['avg_stress'] * 100)}%", stat_val_style)],
        [Spacer(1, 0.1 * inch), Spacer(1, 0.1 * inch)],
        [Paragraph("Deep Work Efficiency", stat_label_style), Paragraph("Peak Stress Internal", stat_label_style)],
        [Paragraph(f"{round(analytics['deep_work_pct'])}%", stat_val_style), Paragraph(f"{analytics['peak_stress_time']}", stat_val_style)],
    ]
    
    summary_table = Table(data, colWidths=[2.5 * inch, 2.5 * inch])
    summary_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 0.4 * inch))
    
    # 3. AI Tutor Advice Section
    story.append(Paragraph("AI Study Tutor Advice", styles['Heading2']))
    story.append(Spacer(1, 0.1 * inch))
    
    advice_box_style = ParagraphStyle(
        'AdviceBox',
        parent=styles['Normal'],
        fontSize=11,
        leading=14,
        leftIndent=10,
        rightIndent=10,
        firstLineIndent=0,
        backColor=colors.HexColor("#F5F7FA"),
        borderPadding=10,
        borderRadius=5,
        borderColor=colors.HexColor("#E2E8F0"),
        borderWidth=1
    )
    
    story.append(Paragraph(f"<i>\"{analytics['ai_guidance']}\"</i>", advice_box_style))
    story.append(Spacer(1, 0.4 * inch))
    
    # 4. State Distribution
    story.append(Paragraph("Session State Breakdown", styles['Heading2']))
    story.append(Spacer(1, 0.1 * inch))
    
    dist_data = [["State", "Samples Count"]]
    for i, label in enumerate(analytics['distribution']['labels']):
        dist_data.append([label, str(analytics['distribution']['values'][i])])
        
    dist_table = Table(dist_data, colWidths=[2.0 * inch, 1.5 * inch])
    dist_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1976D2")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.whitesmoke),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
    ]))
    story.append(dist_table)
    
    # Finalize
    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
