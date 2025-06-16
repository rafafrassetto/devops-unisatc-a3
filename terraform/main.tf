# Define o provedor AWS e a região
provider "aws" {
  region     = "us-east-1"
}

# ------------------------------------------------------------------------------------------------
# VPC e Redes
# ------------------------------------------------------------------------------------------------

resource "aws_vpc" "strapi_vpc" { # Mantém o nome do recurso para não recriar a VPC
  cidr_block           = "10.0.0.0/16" # Bloco CIDR para sua VPC
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = {
    Name = "html-app-vpc" # Nome do tag pode ser mantido ou alterado para 'html-app-vpc'
  }
}

resource "aws_subnet" "public_subnet_1" {
  vpc_id                  = aws_vpc.strapi_vpc.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "us-east-1a" # Escolha uma AZ na sua região
  map_public_ip_on_launch = true
  tags = {
    Name = "strapi-public-subnet-1"
  }
}

resource "aws_subnet" "public_subnet_2" {
  vpc_id                  = aws_vpc.strapi_vpc.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = "us-east-1b" # IMPORTANTE: Uma AZ diferente da public_subnet_1
  map_public_ip_on_launch = true
  tags = {
    Name = "strapi-public-subnet-2"
  }
}

resource "aws_internet_gateway" "strapi_igw" {
  vpc_id = aws_vpc.strapi_vpc.id
  tags = {
    Name = "strapi-igw"
  }
}

resource "aws_route_table" "strapi_public_rt" {
  vpc_id = aws_vpc.strapi_vpc.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.strapi_igw.id
  }
  tags = {
    Name = "strapi-public-rt"
  }
}

resource "aws_route_table_association" "strapi_public_rta_1" {
  subnet_id    = aws_subnet.public_subnet_1.id
  route_table_id = aws_route_table.strapi_public_rt.id
}

resource "aws_route_table_association" "strapi_public_rta_2" {
  subnet_id    = aws_subnet.public_subnet_2.id
  route_table_id = aws_route_table.strapi_public_rt.id
}

# ------------------------------------------------------------------------------------------------
# Security Groups (Atualizado para a porta 80)
# ------------------------------------------------------------------------------------------------

resource "aws_security_group" "strapi_alb_sg" { # Mantém o nome do recurso
  name        = "html-alb-sg" # Nome mais descritivo
  description = "Allow HTTP access to ALB for HTML app"
  vpc_id      = aws_vpc.strapi_vpc.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # Permite acesso HTTP de qualquer lugar
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # Permite acesso HTTPS de qualquer lugar
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = {
    Name = "html-alb-sg" # Tag atualizado
  }
}

resource "aws_security_group" "strapi_ecs_sg" { # Mantém o nome do recurso
  name        = "html-ecs-sg" # Nome mais descritivo
  description = "Allow traffic from ALB to HTML app tasks"
  vpc_id      = aws_vpc.strapi_vpc.id

  ingress {
    from_port       = 80 # <--- PORTA DO NGINX/HTML APP
    to_port         = 80 # <--- PORTA DO NGINX/HTML APP
    protocol        = "tcp"
    security_groups = [aws_security_group.strapi_alb_sg.id] # Permite tráfego apenas do ALB
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = {
    Name = "html-ecs-sg" # Tag atualizado
  }
}

# ------------------------------------------------------------------------------------------------
# IAM Roles para ECS (provavelmente não precisam de mudança)
# ------------------------------------------------------------------------------------------------

resource "aws_iam_role" "ecs_task_execution_role" {
  name = "strapi-ecs-task-execution-role" # Mantém o nome, é genérico

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task_role" {
  name = "strapi-ecs-task-role" # Mantém o nome, é genérico

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      },
    ]
  })
}

# ------------------------------------------------------------------------------------------------
# ECS Cluster (provavelmente não precisa de mudança)
# ------------------------------------------------------------------------------------------------

resource "aws_ecs_cluster" "strapi_cluster" { # Mantém o nome do recurso
  name = "strapi-cluster" # Nome do cluster pode ser mantido ou alterado
  tags = {
    Name = "strapi-cluster"
  }
}

# ------------------------------------------------------------------------------------------------
# ECS Task Definition (atualizado para HTML/Nginx)
# ------------------------------------------------------------------------------------------------

resource "aws_ecs_task_definition" "strapi_task" { # Mantém o nome do recurso
  family                 = "html-app-task-v4" # <--- NOVO NOME DE FAMÍLIA DE TASK
  cpu                    = "256" # <--- CPU REDUZIDA PARA HTML
  memory                 = "512" # <--- MEMÓRIA REDUZIDA PARA HTML
  network_mode           = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  execution_role_arn     = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn          = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name        = "html-app-container" # <--- NOVO NOME DO CONTÊINER
      image       = var.docker_image     # Usa a imagem do Docker Hub (html-app:latest)
      cpu         = 256
      memory      = 512
      essential   = true
      portMappings = [
        {
          containerPort = 80 # <--- PORTA DO NGINX/HTML APP
          hostPort      = 80 # <--- PORTA DO NGINX/HTML APP
          protocol      = "tcp"
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.strapi_logs.name
          "awslogs-region"        = "us-east-1"
          "awslogs-stream-prefix" = "ecs"
        }
      }
      environment = [] # Não precisa de variáveis de ambiente do Strapi
    }
  ])
  tags = {
    Name = "html-app-task-definition-v3" # Tag atualizado
  }
}

# ------------------------------------------------------------------------------------------------
# ECS Service (atualizado para HTML/Nginx)
# ------------------------------------------------------------------------------------------------

resource "aws_ecs_service" "strapi_service" { # Mantém o nome do recurso
  name            = "html-app-service" # <--- NOVO NOME DO SERVIÇO
  cluster         = aws_ecs_cluster.strapi_cluster.id
  task_definition = aws_ecs_task_definition.strapi_task.arn
  desired_count   = 1 # Uma instância do HTML APP rodando

  launch_type     = "FARGATE"

  network_configuration {
    subnets         = [aws_subnet.public_subnet_1.id, aws_subnet.public_subnet_2.id] # Referencia as duas subnets
    security_groups = [aws_security_group.strapi_ecs_sg.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.strapi_tg.arn
    container_name   = "html-app-container" # <--- NOVO NOME DO CONTÊINER
    container_port   = 80                   # <--- PORTA DO NGINX/HTML APP
  }

  depends_on = [aws_lb_listener.strapi_http_listener]

  tags = {
    Name = "html-app-service" # Tag atualizado
  }
}

# ------------------------------------------------------------------------------------------------
# Application Load Balancer (ALB) (atualizado para HTML/Nginx)
# ------------------------------------------------------------------------------------------------

resource "aws_lb" "strapi_alb" { # Mantém o nome do recurso
  name                 = "html-app-alb" # <--- NOVO NOME DO ALB (se quiser, ou mantém strapi-alb)
  internal             = false
  load_balancer_type   = "application"
  security_groups      = [aws_security_group.strapi_alb_sg.id]
  subnets              = [aws_subnet.public_subnet_1.id, aws_subnet.public_subnet_2.id] # Referencia as duas subnets

  enable_deletion_protection = false

  tags = {
    Name = "html-app-alb" # Tag atualizado
  }
}

resource "aws_lb_target_group" "strapi_tg" { # Mantém o nome do recurso
  name        = "html-app-tg" # <--- NOVO NOME DO TARGET GROUP
  port        = 80            # <--- PORTA DO NGINX/HTML APP
  protocol    = "HTTP"
  vpc_id      = aws_vpc.strapi_vpc.id
  target_type = "ip"
  
  health_check {
    path = "/" # <--- PATH RAIZ PARA HEALTH CHECK DO NGINX
    protocol = "HTTP"
    matcher = "200"
    interval = 30
    timeout = 5
    healthy_threshold = 2
    unhealthy_threshold = 2
  }
  tags = {
    Name = "html-app-target-group" # Tag atualizado
  }
}

resource "aws_lb_listener" "strapi_http_listener" { # Mantém o nome do recurso
  load_balancer_arn = aws_lb.strapi_alb.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.strapi_tg.arn
  }
  tags = {
    Name = "html-app-http-listener" # Tag atualizado
  }
}

# ------------------------------------------------------------------------------------------------
# CloudWatch Logs (pode manter, é genérico para logs de contêineres)
# ------------------------------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "strapi_logs" { # Mantém o nome do recurso
  name              = "/ecs/html-app" # Nome do log group mais descritivo
  retention_in_days = 7

  tags = {
    Name = "html-app-log-group" # Tag atualizado
  }
}