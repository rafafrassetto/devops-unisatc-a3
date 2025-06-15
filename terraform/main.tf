# Define o provedor AWS e a região
provider "aws" {
  region     = "us-east-1" # Usando North Virginia
  access_key = var.aws_access_key
  secret_key = var.aws_secret_key
}

# ------------------------------------------------------------------------------------------------
# VPC e Redes
# ------------------------------------------------------------------------------------------------

resource "aws_vpc" "strapi_vpc" {
  cidr_block = "10.0.0.0/16" # Bloco CIDR para sua VPC
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = {
    Name = "strapi-vpc"
  }
}

resource "aws_subnet" "public_subnet_1" {
  vpc_id            = aws_vpc.strapi_vpc.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = "us-east-1a" # Escolha uma AZ na sua região
  map_public_ip_on_launch = true
  tags = {
    Name = "strapi-public-subnet-1"
  }
}

resource "aws_subnet" "public_subnet_2" {
  vpc_id            = aws_vpc.strapi_vpc.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = "us-east-1b" # IMPORTANTE: Uma AZ diferente da public_subnet_1
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
  subnet_id      = aws_subnet.public_subnet_1.id
  route_table_id = aws_route_table.strapi_public_rt.id
}

resource "aws_route_table_association" "strapi_public_rta_2" {
  subnet_id      = aws_subnet.public_subnet_2.id
  route_table_id = aws_route_table.strapi_public_rt.id
}


# ------------------------------------------------------------------------------------------------
# Security Groups
# ------------------------------------------------------------------------------------------------

resource "aws_security_group" "strapi_alb_sg" {
  name        = "strapi-alb-sg"
  description = "Allow HTTP/HTTPS access to ALB"
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
    Name = "strapi-alb-sg"
  }
}

resource "aws_security_group" "strapi_ecs_sg" {
  name        = "strapi-ecs-sg"
  description = "Allow traffic from ALB to ECS tasks"
  vpc_id      = aws_vpc.strapi_vpc.id

  ingress {
    from_port   = 1337 # Porta que o Strapi usa
    to_port     = 1337
    protocol    = "tcp"
    security_groups = [aws_security_group.strapi_alb_sg.id] # Permite tráfego apenas do ALB
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = {
    Name = "strapi-ecs-sg"
  }
}

# ------------------------------------------------------------------------------------------------
# IAM Roles para ECS
# ------------------------------------------------------------------------------------------------

resource "aws_iam_role" "ecs_task_execution_role" {
  name = "strapi-ecs-task-execution-role"

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
  name = "strapi-ecs-task-role"

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
# ECS Cluster
# ------------------------------------------------------------------------------------------------

resource "aws_ecs_cluster" "strapi_cluster" {
  name = "strapi-cluster"
  tags = {
    Name = "strapi-cluster"
  }
}

# ------------------------------------------------------------------------------------------------
# ECS Task Definition (define como o contêiner Strapi será executado)
# ------------------------------------------------------------------------------------------------

resource "aws_ecs_task_definition" "strapi_task" {
  family                   = "strapi-task-v2"
  cpu                      = "1024" # 1 vCPU
  memory                   = "2048" # 2GB RAM
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "strapi-container"
      image     = var.docker_image # Usa a imagem do Docker Hub
      cpu       = 1024
      memory    = 2048
      essential = true
      portMappings = [
        {
          containerPort = 1337
          hostPort      = 1337
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
      environment = [
        # Exemplo de variáveis de ambiente para Strapi, se necessário
        # { name = "DATABASE_CLIENT", value = "sqlite" },
        # { name = "DATABASE_FILENAME", value = ".tmp/data.db" },
        # { name = "APP_KEYS", value = "algumsegredo" } # Substitua por segredo real em produção
      ]
    }
  ])
  tags = {
    Name = "strapi-task-definition-v2"
  }
}

# ------------------------------------------------------------------------------------------------
# ECS Service (gerencia a execução da Task Definition no cluster)
# ------------------------------------------------------------------------------------------------

resource "aws_ecs_service" "strapi_service" {
  name            = "strapi-service-v2"
  cluster         = aws_ecs_cluster.strapi_cluster.id
  task_definition = aws_ecs_task_definition.strapi_task.arn
  desired_count   = 1 # Uma instância do Strapi rodando

  launch_type     = "FARGATE"

  network_configuration {
    subnets         = [aws_subnet.public_subnet_1.id, aws_subnet.public_subnet_2.id] # Referencia as duas subnets
    security_groups = [aws_security_group.strapi_ecs_sg.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.strapi_tg.arn
    container_name   = "strapi-container"
    container_port   = 1337
  }

  depends_on = [aws_lb_listener.strapi_http_listener]

  tags = {
    Name = "strapi-service-v2"
  }
}

# ------------------------------------------------------------------------------------------------
# Application Load Balancer (ALB)
# ------------------------------------------------------------------------------------------------

resource "aws_lb" "strapi_alb" {
  name               = "strapi-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.strapi_alb_sg.id]
  subnets            = [aws_subnet.public_subnet_1.id, aws_subnet.public_subnet_2.id] # Referencia as duas subnets

  enable_deletion_protection = false

  tags = {
    Name = "strapi-alb"
  }
}

resource "aws_lb_target_group" "strapi_tg" {
  name     = "strapi-tg"
  port     = 1337
  protocol = "HTTP"
  vpc_id   = aws_vpc.strapi_vpc.id
  target_type = "ip"
  
  health_check {
    path = "/admin"
    protocol = "HTTP"
    matcher = "200"
    interval = 30
    timeout = 5
    healthy_threshold = 2
    unhealthy_threshold = 2
  }
  tags = {
    Name = "strapi-target-group"
  }
}

resource "aws_lb_listener" "strapi_http_listener" {
  load_balancer_arn = aws_lb.strapi_alb.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.strapi_tg.arn
  }
  tags = {
    Name = "strapi-http-listener"
  }
}

# ------------------------------------------------------------------------------------------------
# CloudWatch Logs
# ------------------------------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "strapi_logs" {
  name              = "/ecs/strapi"
  retention_in_days = 7

  tags = {
    Name = "strapi-log-group"
  }
}
